"""
혼잡 예측 서비스 (FastAPI).

역할 (PRD ⑦):
- KTO 공공데이터를 pandas 로 정제하고 rule-based 스코어링으로 혼잡도를 계산
- 결과를 Supabase congestion_forecast 테이블에 배치로 저장
- Next.js 서버만 이 서비스를 호출한다. 브라우저는 직접 호출하지 않는다

키가 없어도 뜬다. KTO·날씨는 mock 으로 떨어지고, Supabase 키가 없으면
저장만 건너뛴다. 개발 중에 "키가 없어 아무것도 못 해보는" 상태를 만들지 않기 위함이다.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from datetime import date, datetime

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from app.config import SEOUL_TZ, settings
from app.jobs import parse_walk_minutes, run_forecast_job, seoul_today
from app.kto import classify_profile
from app.scoring import score_place_day
from app.scheduler import shutdown_scheduler, start_scheduler
from app.store import get_client
from app.weather import get_weather_source

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(
    title="한적 예측 서비스",
    description="서울 관광지 혼잡도 예측 및 대안 스코어링",
    version="0.2.0",
    lifespan=lifespan,
)


# ──────────────────────────────────────────────────────────────
class HourSlot(BaseModel):
    hour_slot: int
    congestion_pct: int


class Forecast(BaseModel):
    place_id: str
    forecast_date: date
    computed_at: datetime
    slots: list[HourSlot]
    is_mock: bool
    """실제 KTO 데이터인지 mock 인지. UI 의 '예측치' 표기 판단 근거"""


class JobResponse(BaseModel):
    forecast_date: date
    places_scored: int
    rows_written: int
    used_mock_kto: bool
    used_mock_weather: bool
    notes: list[str]


# ──────────────────────────────────────────────────────────────
@app.get("/health")
def health() -> dict[str, object]:
    """배포 플랫폼과 Next.js 가 생존 확인에 쓴다."""
    return {
        "status": "ok",
        "service": "predictor",
        "mock_kto": settings.use_mock_kto,
        "mock_weather": settings.use_mock_weather,
        "can_write_db": settings.can_write_db,
    }


@app.post("/jobs/forecast", response_model=JobResponse)
def trigger_forecast(dry_run: bool = False) -> JobResponse:
    """
    배치를 지금 실행한다.

    스케줄을 기다리지 않고 결과를 확인할 때, 그리고 배포 직후 첫 데이터를
    채울 때 쓴다. dry_run=true 면 계산만 하고 저장하지 않는다.
    """
    result = run_forecast_job(dry_run=dry_run)
    return JobResponse(
        forecast_date=result.forecast_date,
        places_scored=result.places_scored,
        rows_written=result.rows_written,
        used_mock_kto=result.used_mock_kto,
        used_mock_weather=result.used_mock_weather,
        notes=result.notes,
    )


@app.get("/forecast", response_model=Forecast)
def get_forecast(place_id: str, forecast_date: date | None = None) -> Forecast:
    """
    한 장소의 시간대별 예측치를 그 자리에서 계산해 돌려준다.

    화면이 읽는 경로는 이쪽이 아니라 congestion_forecast 테이블이다.
    이 엔드포인트는 "저장된 값이 왜 저렇게 나왔나"를 확인하는 용도다.
    """
    if not settings.can_write_db:
        raise HTTPException(
            status_code=503,
            detail="Supabase 설정이 없어 장소 정보를 읽을 수 없습니다.",
        )

    client = get_client()
    response = (
        client.table("place")
        .select("id, name, category, access_desc, lat, lng")
        .eq("id", place_id)
        .maybe_single()
        .execute()
    )
    place = response.data if response else None
    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다.")

    lat, lng = place.get("lat"), place.get("lng")
    if lat is None or lng is None:
        raise HTTPException(status_code=422, detail="장소에 좌표가 없습니다.")

    hourly = get_weather_source().fetch_hourly(lat=float(lat), lng=float(lng))
    forecasts, _detail = score_place_day(
        # 단건 조회라 다른 장소와 비교할 수 없다. 중간값으로 둔다 —
        # 정확한 인기도는 전체를 함께 정규화하는 배치에서만 나온다.
        popularity=0.5,
        profile=classify_profile(place["name"], place.get("category")),
        walk_minutes=parse_walk_minutes(place.get("access_desc")),
        hourly_weather=hourly,
    )

    return Forecast(
        place_id=place_id,
        forecast_date=forecast_date or seoul_today(),
        computed_at=datetime.now(SEOUL_TZ),
        slots=[
            HourSlot(hour_slot=f.hour_slot, congestion_pct=f.congestion_pct)
            for f in forecasts
        ],
        is_mock=settings.use_mock_kto,
    )
