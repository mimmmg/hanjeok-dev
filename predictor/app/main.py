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
from app.jobs import SEOUL_CENTER_LAT, SEOUL_CENTER_LNG, run_forecast_job, seoul_today
from app.kto import SIGUNGU_CODE_BY_NAME, TourApiClient, classify_profile
from app.scoring import score_from_concentration
from app.scheduler import shutdown_scheduler, start_scheduler
from app.store import get_client
from app.sync import run_place_sync_job
from app.weather import fetch_hourly_safe, get_weather_source

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


class WeatherHour(BaseModel):
    hour_slot: int
    temperature: float
    precipitation_prob: int


class WeatherResponse(BaseModel):
    provider: str
    """실제로 값을 받아온 제공자. 대체됐으면 그 사실이 드러난다"""
    hours: list[WeatherHour]


class SyncResponse(BaseModel):
    concentration_places: int
    tour_places: int
    with_coords: int
    without_coords: int
    written: int
    notes: list[str]


class JobResponse(BaseModel):
    forecast_date: date
    places_scored: int
    rows_written: int
    used_mock_kto: bool
    weather_provider: str
    notes: list[str]


# ──────────────────────────────────────────────────────────────
@app.get("/health")
def health() -> dict[str, object]:
    """배포 플랫폼과 Next.js 가 생존 확인에 쓴다."""
    return {
        "status": "ok",
        "service": "predictor",
        "mock_kto": settings.use_mock_kto,
        "weather_provider": settings.weather_provider,
        "can_write_db": settings.can_write_db,
    }


@app.get("/weather", response_model=WeatherResponse)
def get_weather() -> WeatherResponse:
    """
    서울 기준 오늘 시간대별 날씨.

    화면에 표시할 날씨를 여기서 받아가게 하는 이유: 예측 점수를 계산할 때 쓴
    것과 같은 값을 보여주기 위함이다. 화면이 다른 소스를 쓰면 "25도라고 써놓고
    24도로 계산된" 어긋남이 생긴다.

    장소별로 나누지 않는다. 서비스 지역이 서울 한 도시라 구별 예보를 따로
    받을 실익이 없고, 673곳마다 부르면 같은 응답을 673번 받게 된다.
    """
    hourly, error = fetch_hourly_safe(
        get_weather_source(), lat=SEOUL_CENTER_LAT, lng=SEOUL_CENTER_LNG
    )
    provider = settings.weather_provider
    if error:
        provider = "open-meteo" if "Open-Meteo" in error else "mock"

    return WeatherResponse(
        provider=provider,
        hours=[
            WeatherHour(
                hour_slot=h.hour_slot,
                temperature=h.temperature,
                precipitation_prob=h.precipitation_prob,
            )
            for h in hourly
        ],
    )


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
        weather_provider=result.weather_provider,
        notes=result.notes,
    )


@app.post("/jobs/sync-places", response_model=SyncResponse)
def trigger_place_sync(dry_run: bool = False) -> SyncResponse:
    """
    장소 마스터를 KTO 실데이터로 동기화한다.

    집중률 API 와 TourAPI 의 교집합을 place 에 넣는다. 자주 바뀌는 정보가
    아니라 예측 배치와 달리 스케줄에 걸지 않았다 — 필요할 때 부른다.
    """
    result = run_place_sync_job(dry_run=dry_run)
    return SyncResponse(
        concentration_places=result.concentration_places,
        tour_places=result.tour_places,
        with_coords=result.with_coords,
        without_coords=result.without_coords,
        written=result.written,
        notes=result.notes,
    )


@app.get("/forecast", response_model=Forecast)
def get_forecast(place_id: str, forecast_date: date | None = None) -> Forecast:
    """
    한 장소의 시간대별 예측치를 그 자리에서 계산해 돌려준다.

    화면이 읽는 정상 경로는 congestion_forecast 테이블이다. 이 엔드포인트는
    Next.js Route Handler 가 "가장 최신 값"을 원할 때, 그리고 저장된 값이
    왜 저렇게 나왔는지 확인할 때 쓴다.
    """
    if not settings.can_write_db:
        raise HTTPException(status_code=503, detail="Supabase 설정이 없습니다.")
    if settings.use_mock_kto:
        raise HTTPException(status_code=503, detail="KTO_API_KEY 가 없습니다.")

    client = get_client()
    response = (
        client.table("place")
        .select("id, name, category, district, lat, lng")
        .eq("id", place_id)
        .maybe_single()
        .execute()
    )
    place = response.data if response else None
    if not place:
        raise HTTPException(status_code=404, detail="장소를 찾을 수 없습니다.")

    signgu_cd = SIGUNGU_CODE_BY_NAME.get(place.get("district") or "")
    if not signgu_cd:
        raise HTTPException(status_code=422, detail="서울 자치구 정보가 없습니다.")

    target = forecast_date or seoul_today()

    # 그 구의 집중률에서 이 장소·이 날짜를 찾는다
    kto = TourApiClient(settings.kto_api_key or "")
    rate: float | None = None
    for row in kto.fetch_concentration(signgu_cd=signgu_cd):
        if row.get("tAtsNm") != place["name"]:
            continue
        if row.get("baseYmd") != target.strftime("%Y%m%d"):
            continue
        try:
            rate = float(row.get("cnctrRate", 0))
        except (TypeError, ValueError):
            rate = None
        break

    if rate is None:
        raise HTTPException(
            status_code=404, detail="해당 날짜의 집중률이 없습니다."
        )

    # 날씨는 실패해도 계산을 계속한다 — 스코어의 일부일 뿐이다
    hourly, _ = fetch_hourly_safe(
        get_weather_source(), lat=SEOUL_CENTER_LAT, lng=SEOUL_CENTER_LNG
    )
    forecasts, _detail = score_from_concentration(
        concentration_rate=rate,
        profile=classify_profile(place["name"], place.get("category")),
        hourly_weather=hourly,
    )

    return Forecast(
        place_id=place_id,
        forecast_date=target,
        computed_at=datetime.now(SEOUL_TZ),
        slots=[
            HourSlot(hour_slot=f.hour_slot, congestion_pct=f.congestion_pct)
            for f in forecasts
        ],
        is_mock=False,
    )
