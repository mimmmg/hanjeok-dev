"""
Supabase 쓰기.

이 서비스만 RLS 를 우회하는 secret key 를 갖는다. place 와
congestion_forecast 는 클라이언트 쓰기가 막혀 있어서 이 키가 없으면
배치가 아무것도 못 한다.

Next.js 는 이 테이블을 조회만 한다 — 쓰기 주체가 하나뿐이어야
"누가 이 값을 넣었지"를 되짚을 수 있다.
"""

from __future__ import annotations

import logging
from datetime import date

from supabase import Client, create_client

from app.config import settings
from app.scoring import HourForecast

logger = logging.getLogger(__name__)

# 한 번에 보내는 행 수. 15곳 × 24시간이면 360행이라 한 번에 가지만,
# 장소가 수백 곳으로 늘면 요청이 너무 커진다.
UPSERT_CHUNK = 500


def get_client() -> Client:
    if not settings.can_write_db:
        raise RuntimeError(
            "SUPABASE_URL / SUPABASE_SECRET_KEY 가 필요합니다. .env 를 확인하세요."
        )
    return create_client(settings.supabase_url or "", settings.supabase_secret_key or "")


def fetch_places(client: Client) -> list[dict]:
    """
    예측 대상 장소 목록. 시드가 넣어둔 것을 그대로 쓴다.

    배치가 place 를 새로 만들지 않는 이유: 장소 마스터는 시드 스크립트가
    관리하고 배치는 예측치만 채운다. 쓰기 주체를 나눠두면 장소가 갑자기
    사라지거나 중복되는 사고의 범위가 좁아진다.
    """
    response = (
        client.table("place")
        .select("id, name, district, access_desc, lat, lng, category")
        .execute()
    )
    return response.data or []


def upsert_places(client: Client, rows: list[dict]) -> int:
    """
    장소 마스터를 저장한다.

    kto_content_id UNIQUE 로 upsert 하므로 동기화를 여러 번 돌려도
    중복이 생기지 않고 정보만 갱신된다. 스키마에 이 제약을 미리 걸어둔 게
    여기서 값을 한다.
    """
    written = 0
    for start in range(0, len(rows), UPSERT_CHUNK):
        chunk = rows[start : start + UPSERT_CHUNK]
        client.table("place").upsert(chunk, on_conflict="kto_content_id").execute()
        written += len(chunk)
    return written


def delete_mock_places(client: Client) -> int:
    """
    화면 작업용으로 넣었던 mock 장소를 지운다.

    kto_content_id 에 'mock-' 접두사를 붙여둔 게 이 순간을 위해서였다.
    congestion_forecast·user_favorite 은 on delete cascade 로 함께 정리된다.
    """
    response = (
        client.table("place")
        .delete()
        .like("kto_content_id", "mock-%")
        .execute()
    )
    return len(response.data or [])


def upsert_forecasts(
    client: Client,
    *,
    place_id: str,
    forecast_date: date,
    forecasts: list[HourForecast],
) -> int:
    """
    한 장소의 하루치 예측치를 저장한다.

    (place_id, forecast_date, hour_slot) UNIQUE 제약을 이용한 upsert 라
    배치를 하루에 두 번 돌려도 행이 쌓이지 않고 갱신된다.
    스키마에 이 제약을 미리 걸어둔 게 여기서 값을 한다.
    """
    rows = [
        {
            "place_id": place_id,
            "forecast_date": forecast_date.isoformat(),
            "hour_slot": f.hour_slot,
            "congestion_pct": f.congestion_pct,
        }
        for f in forecasts
    ]
    if not rows:
        return 0

    client.table("congestion_forecast").upsert(
        rows,
        on_conflict="place_id,forecast_date,hour_slot",
    ).execute()
    return len(rows)


def upsert_many(
    client: Client,
    *,
    forecast_date: date,
    by_place: dict[str, list[HourForecast]],
) -> int:
    """여러 장소를 묶어서 저장한다. 요청 수를 줄이려고 청크로 나눈다."""
    rows: list[dict] = []
    for place_id, forecasts in by_place.items():
        rows.extend(
            {
                "place_id": place_id,
                "forecast_date": forecast_date.isoformat(),
                "hour_slot": f.hour_slot,
                "congestion_pct": f.congestion_pct,
            }
            for f in forecasts
        )

    written = 0
    for start in range(0, len(rows), UPSERT_CHUNK):
        chunk = rows[start : start + UPSERT_CHUNK]
        client.table("congestion_forecast").upsert(
            chunk,
            on_conflict="place_id,forecast_date,hour_slot",
        ).execute()
        written += len(chunk)

    return written
