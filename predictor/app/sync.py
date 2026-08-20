"""
장소 마스터 동기화.

기준은 집중률 API 다. 혼잡도를 예측할 수 있는 장소가 곧 이 서비스가
보여줄 수 있는 장소이기 때문이다. 거기에 TourAPI 의 좌표·주소를 덧붙인다.

한때 두 API 의 교집합만 담았는데, 그러면 경복궁·창덕궁·종묘·광화문이
전부 빠졌다. 집중률에는 있지만 TourAPI 지역기반 목록에는 없기 때문이다.
서울 혼잡도를 보여주는 서비스에서 경복궁이 검색되지 않는 건 말이 안 된다.
그래서 집중률을 주 소스로 두고 TourAPI 는 보강재로 쓴다.

좌표가 끝내 없는 장소도 저장한다. 좌표가 없으면 거리 표시와 대안 후보
탐색이 빠지지만, 검색·혼잡도·담기는 그대로 동작한다.
아예 없는 것보다 일부 기능만 빠지는 편이 낫다.

이 작업이 mock 시드를 대체한다 — 장소 마스터의 유일한 쓰기 주체다.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from app.kto import (
    CONTENT_TYPE_CULTURAL,
    CONTENT_TYPE_TOURIST_SPOT,
    SEOUL_SIGUNGU_CODES,
    TourApiClient,
)
from app.landmarks import LANDMARKS
from app.store import get_client, upsert_places
from app.transform import clean_places
from app.redact import redact

logger = logging.getLogger(__name__)

TOUR_AREA_CODE_SEOUL = 1

_BRACKETS = re.compile(r"\[[^\]]*\]|\([^)]*\)")
_SPACES = re.compile(r"\s+")


def normalize_name(name: str) -> str:
    """
    이름을 이어붙이기 위한 표준형.

    두 API 가 같은 곳을 다르게 적는다:
      집중률 "창덕궁과 후원 [유네스코 세계유산]" / TourAPI "창덕궁"
      집중률 "세검정 터 (구 세검정)"           / TourAPI "세검정 터"
    괄호·대괄호 안 설명과 공백을 걷어내면 상당수가 맞는다.
    """
    return _SPACES.sub("", _BRACKETS.sub("", name)).strip()


@dataclass
class SyncResult:
    concentration_places: int
    tour_places: int
    with_coords: int
    without_coords: int
    written: int
    notes: list[str] = field(default_factory=list)


def run_place_sync_job(*, dry_run: bool = False) -> SyncResult:
    from app.config import settings

    notes: list[str] = []

    if settings.use_mock_kto:
        notes.append("KTO_API_KEY 가 없어 장소 동기화를 할 수 없습니다.")
        return SyncResult(0, 0, 0, 0, 0, notes)

    client = TourApiClient(settings.kto_api_key or "")

    # ── 1. 집중률에서 "예측 가능한 장소"를 모은다. 이게 기준이다 ──
    #    {이름: 구 이름}
    place_district: dict[str, str] = {}
    for signgu_cd, gu_name in SEOUL_SIGUNGU_CODES.items():
        try:
            rows = client.fetch_concentration(signgu_cd=signgu_cd)
        except Exception as exc:  # noqa: BLE001 — 한 구가 실패해도 나머지는 간다
            logger.warning("집중률 조회 실패 (%s): %s", gu_name, redact(exc))
            notes.append(f"{gu_name} 집중률 조회 실패")
            continue
        for row in rows:
            name = row.get("tAtsNm")
            if name:
                place_district.setdefault(name, row.get("signguNm") or gu_name)

    if not place_district:
        notes.append("집중률 API 에서 장소를 받지 못했습니다.")
        return SyncResult(0, 0, 0, 0, 0, notes)

    # ── 2. TourAPI 로 좌표·주소를 모은다 (보강재) ──
    raw_places = []
    for content_type in (CONTENT_TYPE_TOURIST_SPOT, CONTENT_TYPE_CULTURAL):
        raw_places.extend(
            client.fetch_places_paged(
                area_code=TOUR_AREA_CODE_SEOUL, content_type_id=content_type
            )
        )
    detail = clean_places(raw_places)

    # 표준형 이름 → 상세정보. 같은 표준형이 여럿이면 먼저 온 것을 쓴다.
    detail_by_norm: dict[str, dict] = {}
    for row in detail.itertuples():
        detail_by_norm.setdefault(
            normalize_name(row.name),
            {
                "kto_content_id": row.kto_content_id,
                "address": row.address or None,
                "lat": float(row.lat),
                "lng": float(row.lng),
            },
        )

    # ── 3. 합치기 ──
    rows: list[dict] = []
    landmark_rows: list[dict] = []
    with_coords = 0
    # 이미 쓴 kto_content_id. 집중률의 서로 다른 이름 둘이 같은 TourAPI 장소로
    # 정규화되는 경우가 있어("창덕궁과 후원", "창덕궁 낙선재"), 그대로 두면
    # 한 배치 안에 같은 키가 두 번 들어가 upsert 가 통째로 실패한다.
    used_ids: set[str] = set()

    for name, district in place_district.items():
        info = detail_by_norm.get(normalize_name(name))
        landmark = LANDMARKS.get(name)

        # TourAPI 에 없는 장소는 landmarks.py 에 직접 적어둔 정보를 쓴다.
        # 상세 API 를 부를 contentid 가 없어 details.py 로도 채울 수 없기 때문이다.
        extra: dict[str, str | None] = {}

        if info:
            lat, lng = info["lat"], info["lng"]
            address = info["address"]
            content_id = info["kto_content_id"]
        elif landmark and "lat" in landmark:
            lat, lng = landmark["lat"], landmark["lng"]
            address = landmark.get("address")
            content_id = ""
            extra = {
                "use_time": landmark.get("use_time"),
                "rest_date": landmark.get("rest_date"),
                "fee": landmark.get("fee"),
                "parking": landmark.get("parking"),
                "info_center": landmark.get("info_center"),
            }
        else:
            lat = lng = None
            address = None
            content_id = ""

        # TourAPI contentid 를 못 쓰거나 이미 쓰였으면 집중률 이름으로 키를 만든다.
        # place 는 집중률 이름 단위로 하나씩 존재해야 하므로 이름이 곧 열쇠다.
        if not content_id or content_id in used_ids:
            content_id = f"cnctr-{name}"
        used_ids.add(content_id)

        if lat is not None:
            with_coords += 1

        rows.append(
            {
                "kto_content_id": content_id,
                "name": name,
                "category": None,
                "district": district,
                "address": address,
                "lat": lat,
                "lng": lng,
            }
        )

        # landmarks.py 에 적어둔 기본정보는 따로 모아 나중에 저장한다.
        # 한 배치에 섞으면 PostgREST 가 키 집합을 통일하면서, 이 키가 없는
        # 나머지 행의 컬럼을 null 로 덮어버린다 — details.py 가 채워둔
        # 상세정보가 동기화 한 번에 통째로 지워졌다.
        if extra:
            landmark_rows.append(
                {
                    "kto_content_id": content_id,
                    "name": name,
                    **{k: v for k, v in extra.items() if v is not None},
                }
            )

    without_coords = len(rows) - with_coords
    notes.append(
        f"집중률 {len(place_district)}곳 중 좌표 확보 {with_coords}곳, "
        f"좌표 없음 {without_coords}곳"
    )

    if dry_run:
        notes.append("dry-run 이라 저장하지 않았습니다.")
        return SyncResult(
            len(place_district), len(detail), with_coords, without_coords, 0, notes
        )

    if not settings.can_write_db:
        notes.append("Supabase 키가 없어 저장을 건너뜁니다.")
        return SyncResult(
            len(place_district), len(detail), with_coords, without_coords, 0, notes
        )

    db = get_client()
    written = upsert_places(db, rows)
    # 기본정보는 별도 배치로 — 위 주석 참고
    if landmark_rows:
        upsert_places(db, landmark_rows)
        notes.append(f"직접 적어둔 기본정보 {len(landmark_rows)}곳 반영")

    return SyncResult(
        concentration_places=len(place_district),
        tour_places=len(detail),
        with_coords=with_coords,
        without_coords=without_coords,
        written=written,
        notes=notes,
    )
