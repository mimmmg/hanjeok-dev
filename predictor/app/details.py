"""
장소 기본정보 보강 — 휴무일·이용시간·주차·입장료·문의처.

TourAPI 목록 API 에는 이 정보가 없어서 장소마다 detailIntro2 를 따로 부른다.
장소 수만큼 호출이 늘기 때문에(현재 277곳) 별도 job 으로 떼어냈다.
예측 배치처럼 하루 두 번 돌릴 필요가 없다 — 영업시간은 자주 바뀌지 않는다.

⚠️ 개발계정은 일 1,000건 한도다. 이 job 하나가 277건을 쓰므로 같은 날
장소 동기화(30건)와 예측 배치(25건)까지 돌려도 여유는 있지만,
여러 번 반복 실행하면 한도에 걸린다. 필요할 때만 부른다.

휴무일은 화면 표시용만이 아니다. 예측 배치가 이 값을 읽어 휴무일 혼잡도를
0 으로 만든다 — 문 닫은 곳을 "여유롭다"고 추천하는 게 가장 큰 사고다.
"""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass, field

from app.kto import TourApiClient
from app.store import get_client, upsert_places
from app.redact import redact

logger = logging.getLogger(__name__)

# TourAPI 는 개행을 <br> 로 준다. 그대로 화면에 넣으면 태그가 글자로 보인다.
_BR = re.compile(r"<br\s*/?>", re.IGNORECASE)
_TAGS = re.compile(r"<[^>]+>")
_SPACES = re.compile(r"[ \t]+")


def clean_text(value: object) -> str | None:
    """TourAPI 원문에서 태그를 걷어내고 공백을 정리한다."""
    if value is None:
        return None
    text = _BR.sub("\n", str(value))
    text = _TAGS.sub("", text)
    text = _SPACES.sub(" ", text)
    text = "\n".join(line.strip() for line in text.split("\n"))
    text = text.strip()
    return text or None


@dataclass
class DetailResult:
    targets: int
    """상세 조회 대상 장소 수 (실제 TourAPI contentid 가 있는 것)"""
    fetched: int
    updated: int
    failed: int
    notes: list[str] = field(default_factory=list)


def run_detail_sync_job(*, limit: int | None = None) -> DetailResult:
    """
    place 중 TourAPI contentid 가 있는 장소의 기본정보를 채운다.

    limit 을 주면 그만큼만 처리한다. 한도가 걱정될 때 나눠 돌리기 위한 것이다.
    """
    from app.config import settings

    notes: list[str] = []

    if settings.use_mock_kto:
        notes.append("KTO_API_KEY 가 없어 상세정보를 받을 수 없습니다.")
        return DetailResult(0, 0, 0, 0, notes)
    if not settings.can_write_db:
        notes.append("Supabase 키가 없어 저장할 수 없습니다.")
        return DetailResult(0, 0, 0, 0, notes)

    client = get_client()

    # 집중률로만 들어온 장소는 kto_content_id 가 'cnctr-' 로 시작해 상세 조회를
    # 할 수 없다. TourAPI 에서 온 것만 대상이다.
    response = (
        client.table("place")
        .select("id, name, kto_content_id")
        .not_.like("kto_content_id", "cnctr-%")
        .execute()
    )
    targets = response.data or []
    if limit:
        targets = targets[:limit]

    if not targets:
        notes.append("상세 조회 대상이 없습니다.")
        return DetailResult(0, 0, 0, 0, notes)

    kto = TourApiClient(settings.kto_api_key or "")
    rows: list[dict] = []
    failed = 0

    for place in targets:
        content_id = place["kto_content_id"]
        try:
            # contentTypeId 를 모르면 관광지(12)로 먼저 시도한다.
            # 문화시설(14)인 장소는 빈 응답이 오므로 한 번 더 시도한다.
            detail = kto.fetch_place_detail(content_id=content_id, content_type_id=12)
            if not detail:
                detail = kto.fetch_place_detail(
                    content_id=content_id, content_type_id=14
                )
        except Exception as exc:  # noqa: BLE001 — 한 곳이 실패해도 나머지는 간다
            logger.warning("상세 조회 실패 (%s): %s", place["name"], redact(exc))
            failed += 1
            continue

        if not detail:
            failed += 1
            continue

        # 관광지(12)와 문화시설(14)의 필드 이름이 다르다.
        # 12: restdate/usetime/parking/expguide, 14: restdate/usetimeculture/parkingculture/usefee
        rows.append(
            {
                "kto_content_id": content_id,
                "name": place["name"],  # upsert 에 not null 컬럼이 필요하다
                "rest_date": clean_text(
                    detail.get("restdate") or detail.get("restdateculture")
                ),
                "use_time": clean_text(
                    detail.get("usetime") or detail.get("usetimeculture")
                ),
                "parking": clean_text(
                    detail.get("parking") or detail.get("parkingculture")
                ),
                "info_center": clean_text(
                    detail.get("infocenter") or detail.get("infocenterculture")
                ),
                "fee": clean_text(
                    detail.get("usefee") or detail.get("usefeeculture")
                ),
            }
        )

    updated = upsert_places(client, rows) if rows else 0

    notes.append(f"대상 {len(targets)}곳 중 {len(rows)}곳 수집, {failed}곳 실패")
    return DetailResult(
        targets=len(targets),
        fetched=len(rows),
        updated=updated,
        failed=failed,
        notes=notes,
    )
