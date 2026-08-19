"""
장소 마스터 동기화 — 두 KTO API 의 교집합을 place 테이블로 만든다.

집중률 API 는 "이 관광지가 며칠에 얼마나 붐빌지"를 주지만 좌표·주소가 없다.
TourAPI 는 좌표·주소·입장료를 주지만 혼잡 예측은 없다.
둘을 관광지명으로 이어붙여야 화면에 필요한 정보가 다 갖춰진다.

교집합만 담는 이유:
- 집중률이 없는 장소는 검색돼도 "예측 없음"만 뜬다. 혼잡도를 보여주려고
  만든 서비스에서 그건 빈손이다.
- 좌표가 없는 장소는 거리 계산도 지도 링크도 안 된다.

이 작업이 mock 시드를 대체한다. web/scripts/seed.ts 는 삭제됐다 —
장소 마스터를 두 곳에서 관리하면 어느 쪽이 진짜인지 알 수 없게 된다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.kto import (
    CONTENT_TYPE_CULTURAL,
    CONTENT_TYPE_TOURIST_SPOT,
    SEOUL_SIGUNGU_CODES,
    TourApiClient,
)
from app.store import get_client, upsert_places
from app.transform import clean_places

logger = logging.getLogger(__name__)

# TourAPI 지역코드 1 = 서울
TOUR_AREA_CODE_SEOUL = 1


@dataclass
class SyncResult:
    tour_places: int
    """TourAPI 에서 받은 장소 수"""
    concentration_places: int
    """집중률 API 에 있는 장소 수"""
    matched: int
    """이름이 일치해 place 로 저장된 수"""
    written: int
    notes: list[str] = field(default_factory=list)


def run_place_sync_job(*, dry_run: bool = False) -> SyncResult:
    from app.config import settings

    notes: list[str] = []

    if settings.use_mock_kto:
        notes.append("KTO_API_KEY 가 없어 장소 동기화를 할 수 없습니다.")
        return SyncResult(0, 0, 0, 0, notes)

    client = TourApiClient(settings.kto_api_key or "")

    # ── 1. TourAPI 로 좌표·주소가 있는 장소를 모은다 ──
    raw_places = []
    for content_type in (CONTENT_TYPE_TOURIST_SPOT, CONTENT_TYPE_CULTURAL):
        rows = client.fetch_places_paged(
            area_code=TOUR_AREA_CODE_SEOUL, content_type_id=content_type
        )
        logger.info("TourAPI contentTypeId=%d → %d건", content_type, len(rows))
        raw_places.extend(rows)

    detail = clean_places(raw_places)
    if detail.empty:
        notes.append("TourAPI 에서 장소를 받지 못했습니다.")
        return SyncResult(0, 0, 0, 0, notes)

    # ── 2. 집중률 API 로 "예측 가능한 장소" 이름을 모은다 ──
    concentration_names: set[str] = set()
    for signgu_cd, gu_name in SEOUL_SIGUNGU_CODES.items():
        try:
            rows = client.fetch_concentration(signgu_cd=signgu_cd)
        except Exception as exc:  # noqa: BLE001 — 한 구가 실패해도 나머지는 간다
            logger.warning("집중률 조회 실패 (%s): %s", gu_name, exc)
            notes.append(f"{gu_name} 집중률 조회 실패")
            continue
        concentration_names.update(row["tAtsNm"] for row in rows)

    if not concentration_names:
        notes.append("집중률 API 에서 장소를 받지 못했습니다.")
        return SyncResult(len(detail), 0, 0, 0, notes)

    # ── 3. 교집합 ──
    matched = detail[detail["name"].isin(concentration_names)].copy()

    notes.append(
        f"TourAPI {len(detail)}곳 ∩ 집중률 {len(concentration_names)}곳 "
        f"= {len(matched)}곳"
    )

    if dry_run:
        notes.append("dry-run 이라 저장하지 않았습니다.")
        return SyncResult(
            tour_places=len(detail),
            concentration_places=len(concentration_names),
            matched=len(matched),
            written=0,
            notes=notes,
        )

    if not settings.can_write_db:
        notes.append("Supabase 키가 없어 저장을 건너뜁니다.")
        return SyncResult(len(detail), len(concentration_names), len(matched), 0, notes)

    rows = [
        {
            "kto_content_id": r.kto_content_id,
            "name": r.name,
            "category": None,
            "district": r.district,
            "address": r.address or None,
            "lat": float(r.lat),
            "lng": float(r.lng),
            "access_desc": None,
            "fee": None,
        }
        for r in matched.itertuples()
    ]

    written = upsert_places(get_client(), rows)
    return SyncResult(
        tour_places=len(detail),
        concentration_places=len(concentration_names),
        matched=len(matched),
        written=written,
        notes=notes,
    )
