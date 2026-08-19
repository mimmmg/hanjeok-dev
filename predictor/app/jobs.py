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
from app.kto import classify_profile, get_kto_source
from app.scoring import HourForecast, score_place_day
from app.store import fetch_places, get_client, upsert_many
from app.transform import clean_places, normalize_popularity
from app.weather import get_weather_source

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
    by_name = {row["name"]: row for row in db_places}
    popularity_by_name = dict(zip(cleaned["name"], cleaned["popularity"]))

    by_place: dict[str, list[HourForecast]] = {}
    matched = 0

    for db_place in db_places:
        name = db_place["name"]
        lat = db_place.get("lat")
        lng = db_place.get("lng")
        if lat is None or lng is None:
            continue

        # KTO 쪽에 없는 장소는 이름으로 유형만 추정하고 인기도는 중간값으로 둔다.
        # 시드 데이터(15곳)와 KTO mock(4곳)이 다르기 때문에 필요한 처리다.
        pop = popularity_by_name.get(name)
        if pop is None:
            pop = 0.5
        else:
            matched += 1

        profile = classify_profile(name, db_place.get("category"))
        hourly = weather_source.fetch_hourly(lat=float(lat), lng=float(lng))

        forecasts, _detail = score_place_day(
            popularity=float(pop),
            profile=profile,
            walk_minutes=parse_walk_minutes(db_place.get("access_desc")),
            hourly_weather=hourly,
        )
        by_place[db_place["id"]] = forecasts

    written = upsert_many(client, forecast_date=forecast_date, by_place=by_place)

    notes.append(
        f"DB 장소 {len(db_places)}곳 중 {matched}곳이 KTO 수집분과 이름으로 연결됐습니다."
    )
    if matched < len(db_places):
        notes.append(
            "나머지는 인기도 중간값으로 계산했습니다. KTO 실데이터가 들어오면 해소됩니다."
        )
    _ = by_name  # 이름 인덱스는 향후 kto_content_id 매칭으로 교체 예정

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
    for row in cleaned.itertuples():
        hourly = weather_source.fetch_hourly(lat=float(row.lat), lng=float(row.lng))
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
