"""
배치 job — 수집 → 정제 → 스코어링 → 저장.

하루 1~2회만 돈다(PRD ⑦). 사용자 요청마다 계산하지 않는 이유는
응답 속도 때문만이 아니다. 예측 결과가 테이블에 남아 있으면 이 서비스가
죽어도 Next.js 가 마지막 저장분을 읽어 화면이 멈추지 않는다.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from datetime import date, datetime

from app.config import KTO_AREA_CODE_SEOUL, KTO_CONTENT_TYPE_TOURIST_SPOT, SEOUL_TZ
from app.datasets import day_factor, measured_daily_visitors
from app.kto import classify_profile, get_kto_source
from app.scoring import HourForecast, score_place_day
from app.store import fetch_places, get_client, upsert_many
from app.transform import clean_places, normalize_popularity
from app.weather import fetch_hourly_safe, get_weather_source

logger = logging.getLogger(__name__)

_WALK_MINUTES = re.compile(r"도보\s*(\d+)\s*분")


def parse_walk_minutes(access_desc: str | None) -> int | None:
    """'3호선 안국역 3번 출구 도보 5분' 에서 5를 꺼낸다."""
    if not access_desc:
        return None
    match = _WALK_MINUTES.search(access_desc)
    return int(match.group(1)) if match else None


def seoul_today() -> date:
    return datetime.now(SEOUL_TZ).date()


# 실측 일평균을 0~1 인기도로 바꿀 때 쓰는 기준.
# 경복궁 일평균이 약 18,900명이라, 2만 명을 "가장 붐비는 축"으로 놓는다.
# 이 값을 넘는 장소는 1.0 으로 묶인다.
MEASURED_VISITOR_CEILING = 20_000.0

# 날씨를 대표로 받아올 지점 — 서울 시청 부근.
# 서비스 지역이 서울 한 도시라 구별로 예보를 나눌 실익이 없다.
SEOUL_CENTER_LAT = 37.5665
SEOUL_CENTER_LNG = 126.9780


def _popularity_from_measured(measured: dict[str, float]) -> dict[str, float]:
    """
    실측 일평균 관람객을 0~1 인기도로 바꾼다.

    KTO 수집분과 달리 서로 비교해 정규화하지 않고 절대 기준(2만 명)을 쓴다.
    실측 대상이 5곳뿐이라 상대 정규화하면 그 안에서만 줄을 세우게 되고,
    "종묘가 5곳 중 꼴찌"라는 이유로 인기도 0 이 되어버린다.
    """
    return {
        name: min(1.0, visitors / MEASURED_VISITOR_CEILING)
        for name, visitors in measured.items()
    }


@dataclass
class JobResult:
    forecast_date: date
    places_scored: int
    rows_written: int
    used_mock_kto: bool
    used_mock_weather: bool
    notes: list[str]


def run_forecast_job(*, dry_run: bool = False) -> JobResult:
    """
    예측 배치 한 번 실행.

    dry_run 이면 계산까지만 하고 저장하지 않는다. 키 없이 파이프라인이
    도는지 확인할 때 쓴다.
    """
    from app.config import settings  # 실행 시점의 환경변수를 읽는다

    notes: list[str] = []
    forecast_date = seoul_today()

    kto = get_kto_source()
    weather_source = get_weather_source()

    # ── 1. 수집 ──
    raw_places = kto.fetch_places(
        area_code=KTO_AREA_CODE_SEOUL,
        content_type_id=KTO_CONTENT_TYPE_TOURIST_SPOT,
    )
    raw_stats = kto.fetch_visitor_stats()

    # ── 2. 정제 ──
    cleaned = clean_places(raw_places, raw_stats)
    popularity = normalize_popularity(cleaned)
    cleaned = cleaned.assign(popularity=popularity)

    if cleaned.empty:
        notes.append("정제 결과가 비어 있습니다. 수집 단계를 확인하세요.")
        return JobResult(
            forecast_date=forecast_date,
            places_scored=0,
            rows_written=0,
            used_mock_kto=settings.use_mock_kto,
            used_mock_weather=settings.use_mock_weather,
            notes=notes,
        )

    # ── 3. 저장 대상 맞추기 ──
    # 예측치는 DB 의 place.id 에 붙어야 한다. KTO 원본에는 그 uuid 가 없으므로
    # kto_content_id 로 이어붙인다. 시드가 넣어둔 장소가 기준이다.
    if dry_run or not settings.can_write_db:
        if not settings.can_write_db:
            notes.append("Supabase 키가 없어 저장을 건너뜁니다.")
        rows = _score_without_db(cleaned, weather_source)
        return JobResult(
            forecast_date=forecast_date,
            places_scored=len(rows),
            rows_written=0,
            used_mock_kto=settings.use_mock_kto,
            used_mock_weather=settings.use_mock_weather,
            notes=notes,
        )

    client = get_client()
    db_places = fetch_places(client)
    if not db_places:
        notes.append("place 테이블이 비어 있습니다. 먼저 시드를 넣으세요.")
        return JobResult(
            forecast_date=forecast_date,
            places_scored=0,
            rows_written=0,
            used_mock_kto=settings.use_mock_kto,
            used_mock_weather=settings.use_mock_weather,
            notes=notes,
        )

    # 이름으로 잇는다. kto_content_id 가 실데이터로 바뀌면 그 컬럼으로 바꾼다.
    popularity_by_name = dict(zip(cleaned["name"], cleaned["popularity"]))

    # 실측 일평균이 있는 장소(4대궁·종묘)는 추정 대신 실측으로 인기도를 매긴다.
    measured = measured_daily_visitors()
    measured_pop = _popularity_from_measured(measured)

    factor = day_factor(forecast_date)

    # 날씨는 한 번만 받아 모든 장소에 쓴다. 서비스 지역이 서울 한 도시라
    # 장소마다 부르면 같은 예보를 15번 받게 된다.
    hourly, weather_error = fetch_hourly_safe(
        weather_source, lat=SEOUL_CENTER_LAT, lng=SEOUL_CENTER_LNG
    )
    if weather_error:
        notes.append(f"날씨 조회 실패로 mock 을 썼습니다: {weather_error}")

    by_place: dict[str, list[HourForecast]] = {}
    matched_kto = 0
    matched_measured = 0

    for db_place in db_places:
        name = db_place["name"]
        lat = db_place.get("lat")
        lng = db_place.get("lng")
        if lat is None or lng is None:
            continue

        # 우선순위: 실측 통계 > KTO 수집분 > 중간값.
        # 실측이 있는데 추정을 쓰면 가진 근거를 버리는 셈이다.
        if name in measured_pop:
            pop = measured_pop[name]
            matched_measured += 1
        elif name in popularity_by_name:
            pop = float(popularity_by_name[name])
            matched_kto += 1
        else:
            pop = 0.5

        profile = classify_profile(name, db_place.get("category"))

        forecasts, _detail = score_place_day(
            popularity=pop,
            profile=profile,
            walk_minutes=parse_walk_minutes(db_place.get("access_desc")),
            hourly_weather=hourly,
            day_factor=factor,
        )
        by_place[db_place["id"]] = forecasts

    written = upsert_many(client, forecast_date=forecast_date, by_place=by_place)

    weekday_names = "월화수목금토일"
    notes.append(
        f"{weekday_names[forecast_date.weekday()]}요일 · {forecast_date.month}월 "
        f"계수 {factor:.2f} 적용"
    )
    notes.append(
        f"DB 장소 {len(db_places)}곳 중 실측 {matched_measured}곳, "
        f"KTO 수집 {matched_kto}곳, 추정 "
        f"{len(db_places) - matched_measured - matched_kto}곳"
    )

    return JobResult(
        forecast_date=forecast_date,
        places_scored=len(by_place),
        rows_written=written,
        used_mock_kto=settings.use_mock_kto,
        used_mock_weather=settings.use_mock_weather,
        notes=notes,
    )


def _score_without_db(cleaned, weather_source) -> list[dict]:
    """DB 없이 계산만 해본다. 파이프라인 점검용."""
    results: list[dict] = []
    hourly, _ = fetch_hourly_safe(
        weather_source, lat=SEOUL_CENTER_LAT, lng=SEOUL_CENTER_LNG
    )
    for row in cleaned.itertuples():
        forecasts, detail = score_place_day(
            popularity=float(row.popularity),
            profile=row.profile,
            walk_minutes=None,
            hourly_weather=hourly,
        )
        peak = max(forecasts, key=lambda f: f.congestion_pct)
        results.append(
            {
                "name": row.name,
                "profile": row.profile,
                "peak_hour": peak.hour_slot,
                "peak_pct": peak.congestion_pct,
                "detail": detail,
            }
        )
    return results
