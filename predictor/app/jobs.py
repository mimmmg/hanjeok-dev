"""
배치 job — 집중률 수집 → 시간대 분해 → 저장.

하루 1~2회만 돈다(PRD ⑦). 사용자 요청마다 계산하지 않는 이유는
응답 속도 때문만이 아니다. 예측 결과가 테이블에 남아 있으면 이 서비스가
죽어도 Next.js 가 마지막 저장분을 읽어 화면이 멈추지 않는다.

집중률 API 가 향후 30일치를 한 번에 주므로, 오늘 하루가 아니라
앞으로 며칠치를 미리 채워둔다. 배치가 하루 걸러 실패해도 화면은 멀쩡하다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from app.config import SEOUL_TZ
from app.kto import SEOUL_SIGUNGU_CODES, TourApiClient, classify_profile
from app.restdays import is_closed_on
from app.scoring import HourForecast, score_from_concentration
from app.store import fetch_places, get_client, upsert_many
from app.weather import fetch_hourly_safe, get_weather_source
from app.redact import redact

logger = logging.getLogger(__name__)

# 날씨를 대표로 받아올 지점 — 서울 시청 부근.
# 서비스 지역이 서울 한 도시라 구별로 예보를 나눌 실익이 없다.
SEOUL_CENTER_LAT = 37.5665
SEOUL_CENTER_LNG = 126.9780

# 며칠치를 저장할지. 집중률은 30일치를 주지만 전부 넣으면
# 장소 258곳 × 30일 × 24시간 = 18만 행이 된다.
# 화면이 쓰는 건 오늘과 가까운 며칠이라 7일이면 충분하다.
FORECAST_DAYS = 7


def seoul_today() -> date:
    return datetime.now(SEOUL_TZ).date()


def _parse_ymd(value: str) -> date | None:
    """'20260819' → date. 형식이 다르면 None."""
    try:
        return datetime.strptime(value, "%Y%m%d").date()
    except (TypeError, ValueError):
        return None


@dataclass
class JobResult:
    forecast_date: date
    places_scored: int
    rows_written: int
    used_mock_kto: bool
    # 어느 날씨 제공자를 실제로 썼는지. 불리언 하나로는 셋을 구분할 수 없다.
    weather_provider: str
    notes: list[str] = field(default_factory=list)


def run_forecast_job(*, dry_run: bool = False) -> JobResult:
    from app.config import settings

    notes: list[str] = []
    today = seoul_today()

    if settings.use_mock_kto:
        notes.append("KTO_API_KEY 가 없어 집중률을 받을 수 없습니다.")
        return JobResult(today, 0, 0, True, settings.weather_provider, notes)

    if not settings.can_write_db:
        notes.append("Supabase 키가 없어 저장을 건너뜁니다.")
        return JobResult(today, 0, 0, False, settings.weather_provider, notes)

    client = get_client()
    db_places = fetch_places(client)
    if not db_places:
        notes.append("place 테이블이 비어 있습니다. 먼저 장소 동기화를 돌리세요.")
        return JobResult(today, 0, 0, False, settings.weather_provider, notes)

    # 이름 → DB 행. 집중률 API 도 KTO 라 관광지명 표기가 같다.
    place_by_name = {row["name"]: row for row in db_places}

    # ── 1. 집중률 수집 ──
    kto = TourApiClient(settings.kto_api_key or "")
    # {장소명: {날짜: 집중률}}
    rates: dict[str, dict[date, float]] = {}

    for signgu_cd, gu_name in SEOUL_SIGUNGU_CODES.items():
        try:
            rows = kto.fetch_concentration(signgu_cd=signgu_cd)
        except Exception as exc:  # noqa: BLE001 — 한 구가 실패해도 나머지는 간다
            logger.warning("집중률 조회 실패 (%s): %s", gu_name, redact(exc))
            notes.append(f"{gu_name} 집중률 조회 실패")
            continue

        for row in rows:
            name = row.get("tAtsNm")
            if name not in place_by_name:
                continue
            day = _parse_ymd(row.get("baseYmd", ""))
            if day is None:
                continue
            try:
                rate = float(row.get("cnctrRate", 0))
            except (TypeError, ValueError):
                continue
            rates.setdefault(name, {})[day] = rate

    if not rates:
        notes.append("집중률과 이름이 맞는 장소가 없습니다.")
        return JobResult(today, 0, 0, False, settings.weather_provider, notes)

    # ── 2. 날씨 (하루 한 번, 서울 대표 지점) ──
    hourly, weather_error = fetch_hourly_safe(
        get_weather_source(), lat=SEOUL_CENTER_LAT, lng=SEOUL_CENTER_LNG
    )
    weather_used = settings.weather_provider
    if weather_error:
        notes.append(f"날씨: {weather_error}")
        weather_used = "open-meteo" if "Open-Meteo" in weather_error else "mock"
    else:
        notes.append(f"날씨: {weather_used} 사용")

    # ── 3. 시간대 분해 후 저장 ──
    target_days = [today + timedelta(days=offset) for offset in range(FORECAST_DAYS)]
    written = 0
    scored_places = 0
    closed_count = 0

    for day in target_days:
        by_place: dict[str, list[HourForecast]] = {}

        for name, by_date in rates.items():
            rate = by_date.get(day)
            if rate is None:
                continue
            db_place = place_by_name[name]

            # 휴무일에는 혼잡도를 0 으로 둔다.
            # 문 닫은 곳을 "여유롭다"고 추천하는 게 가장 큰 사고다.
            if is_closed_on(db_place.get("rest_date"), day):
                by_place[db_place["id"]] = [
                    HourForecast(hour_slot=h, congestion_pct=0) for h in range(24)
                ]
                closed_count += 1
                continue

            profile = classify_profile(name, db_place.get("category"))
            forecasts, _detail = score_from_concentration(
                concentration_rate=rate,
                profile=profile,
                hourly_weather=hourly,
            )
            by_place[db_place["id"]] = forecasts

        if not by_place:
            continue
        if day == today:
            scored_places = len(by_place)
        if not dry_run:
            written += upsert_many(client, forecast_date=day, by_place=by_place)

    if closed_count:
        notes.append(f"휴무일이라 0 으로 둔 장소·날짜 조합 {closed_count}건")
    notes.append(
        f"장소 {len(rates)}곳 × {FORECAST_DAYS}일치 계산 "
        f"({target_days[0]} ~ {target_days[-1]})"
    )
    if dry_run:
        notes.append("dry-run 이라 저장하지 않았습니다.")

    return JobResult(
        forecast_date=today,
        places_scored=scored_places,
        rows_written=written,
        used_mock_kto=False,
        weather_provider=weather_used,
        notes=notes,
    )
