"""
혼잡 예측 서비스 (FastAPI).

역할 (PRD ⑦):
- KTO 공공데이터를 pandas로 정제하고, rule-based 스코어링으로 혼잡도를 계산한다.
- 계산 결과는 Supabase의 congestion_forecast 테이블에 배치로 저장한다.
- Next.js 서버만 이 서비스를 호출한다. 브라우저는 직접 호출하지 않는다.

현재 상태: 워킹 스켈레톤. 실제 KTO 데이터 대신 결정론적 더미 곡선을 반환한다.
"""

from datetime import date, datetime, timezone

from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(
    title="한적 예측 서비스",
    description="서울 관광지 혼잡도 예측 및 대안 스코어링",
    version="0.1.0",
)


class HourSlot(BaseModel):
    hour_slot: int  # 0~23
    congestion_pct: int  # 0~100


class Forecast(BaseModel):
    place_id: str
    forecast_date: date
    computed_at: datetime
    slots: list[HourSlot]
    is_mock: bool  # 더미 데이터인지 — UI가 "예측치" 표기를 판단하는 근거


@app.get("/health")
def health() -> dict[str, str]:
    """배포 플랫폼(Render/Railway)과 Next.js가 생존 확인에 쓴다."""
    return {"status": "ok", "service": "predictor"}


# 관광지의 하루 방문 패턴을 단순화한 곡선.
# 새벽엔 비고 오후 2~4시에 정점을 찍는 형태 — 실제 KTO 데이터가 들어오면 대체된다.
_MOCK_CURVE = [
    2, 1, 1, 1, 2, 4, 8, 15, 24, 38, 52, 63,
    71, 76, 78, 74, 66, 57, 46, 34, 24, 16, 9, 4,
]


@app.get("/forecast")
def get_forecast(place_id: str, forecast_date: date | None = None) -> Forecast:
    """
    한 장소의 시간대별 혼잡 예측치를 반환한다.

    응답 구조는 congestion_forecast 테이블과 1:1로 맞춰뒀다.
    나중에 배치가 이 결과를 그대로 upsert 할 수 있게 하기 위함이다.
    """
    target = forecast_date or date.today()

    return Forecast(
        place_id=place_id,
        forecast_date=target,
        computed_at=datetime.now(timezone.utc),
        slots=[
            HourSlot(hour_slot=hour, congestion_pct=pct)
            for hour, pct in enumerate(_MOCK_CURVE)
        ],
        is_mock=True,
    )
