"""
KTO 공공데이터 수집기.

지금은 실제 API 키가 없어도 돌아가야 해서 인터페이스를 먼저 잡고
mock 구현을 함께 둔다. 키가 생기면 TourApiClient 만 채우면 되고,
정제·스코어링·저장 쪽 코드는 손대지 않는다.

받아오는 데이터는 성격이 둘로 나뉜다:
1. 장소 마스터(areaBasedList) — 이름·좌표·주소. 자주 안 바뀐다.
2. 방문자 통계 — 장소가 얼마나 붐비는지의 근거. 이쪽이 예측의 원료다.

중요한 한계: TourAPI 는 '시간대별' 방문자 수를 주지 않는다. 일/월 단위다.
그래서 시간대 분포는 통계가 아니라 장소 유형별 규칙(scoring.py)으로 만든다.
이 구분을 흐리면 "예측치"라고 표기한 근거가 사라진다.
"""

from __future__ import annotations

import logging
from typing import Protocol

import httpx

from app.config import (
    KTO_AREA_CODE_SEOUL,
    KTO_CONTENT_TYPE_TOURIST_SPOT,
    settings,
)

logger = logging.getLogger(__name__)

TOUR_API_BASE = "https://apis.data.go.kr/B551011/KorService2"

# 장소 유형 분류용 키워드. TourAPI 의 cat3 코드로도 되지만
# 코드표를 통째로 들고 있어야 해서, 우선 이름·분류 텍스트로 가른다.
PROFILE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "palace": ("궁", "능", "한옥", "서원", "향교", "유적"),
    "park": ("공원", "숲", "수목원", "하천", "산", "호수"),
    "indoor": ("박물관", "미술관", "전시", "타워", "아쿠아리움", "몰", "센터"),
    "street": ("거리", "시장", "골목", "상가", "마을"),
}


class RawPlace(dict):
    """TourAPI areaBasedList 한 건. 원본 키를 그대로 유지한다."""


class RawVisitorStat(dict):
    """방문자 통계 한 건. 장소 식별자와 방문자 수를 담는다."""


class KtoSource(Protocol):
    """수집기 인터페이스. mock 과 실제 구현이 이걸 공유한다."""

    def fetch_places(self, *, area_code: int, content_type_id: int) -> list[RawPlace]:
        ...

    def fetch_visitor_stats(self) -> list[RawVisitorStat]:
        ...


# ──────────────────────────────────────────────────────────────
# 실제 구현 — 키가 생기면 여기만 채운다
# ──────────────────────────────────────────────────────────────
class TourApiClient:
    def __init__(self, api_key: str, timeout: float = 10.0) -> None:
        self._api_key = api_key
        self._timeout = timeout

    def _get(self, path: str, params: dict[str, object]) -> list[dict]:
        query = {
            "serviceKey": self._api_key,
            "MobileOS": "ETC",
            "MobileApp": "hanjeok",
            "_type": "json",
            **params,
        }
        with httpx.Client(timeout=self._timeout) as client:
            response = client.get(f"{TOUR_API_BASE}/{path}", params=query)
            response.raise_for_status()
            payload = response.json()

        # TourAPI 는 성공/실패 모두 200 으로 주고 body 안에 결과 코드를 담는다.
        # items 가 빈 문자열로 오는 경우가 있어 그대로 인덱싱하면 터진다.
        body = payload.get("response", {}).get("body", {})
        items = body.get("items")
        if not items:
            logger.warning("TourAPI %s 응답에 items 없음: %s", path, body)
            return []
        return items.get("item", [])

    def fetch_places(self, *, area_code: int, content_type_id: int) -> list[RawPlace]:
        rows = self._get(
            "areaBasedList2",
            {
                "areaCode": area_code,
                "contentTypeId": content_type_id,
                "numOfRows": 200,
                "pageNo": 1,
                "arrange": "A",
            },
        )
        return [RawPlace(row) for row in rows]

    def fetch_visitor_stats(self) -> list[RawVisitorStat]:
        # 한국관광 데이터랩의 방문자 통계는 TourAPI 와 다른 계통이라
        # 별도 연동이 필요하다. 데이터를 확보하면 여기를 채운다.
        logger.warning("방문자 통계 연동이 아직 없습니다. 빈 목록을 반환합니다.")
        return []


# ──────────────────────────────────────────────────────────────
# mock — 키 없이 전체 파이프라인을 돌려보기 위한 것
# ──────────────────────────────────────────────────────────────
_MOCK_PLACES: list[dict] = [
    {
        "contentid": "mock-gyeongbokgung",
        "title": "경복궁",
        "addr1": "서울 종로구 사직로 161",
        "mapx": "126.9770",
        "mapy": "37.5796",
        "sigungucode": "23",
        "cat1": "A02",
    },
    {
        "contentid": "mock-myeongdong",
        "title": "명동 거리",
        "addr1": "서울 중구 명동길 14",
        "mapx": "126.9827",
        "mapy": "37.5636",
        "sigungucode": "24",
        "cat1": "A04",
    },
    {
        "contentid": "mock-seoul-forest",
        "title": "서울숲 공원",
        "addr1": "서울 성동구 뚝섬로 273",
        "mapx": "127.0374",
        "mapy": "37.5444",
        "sigungucode": "20",
        "cat1": "A01",
    },
    {
        "contentid": "mock-national-museum",
        "title": "국립중앙박물관",
        "addr1": "서울 용산구 서빙고로 137",
        "mapx": "126.9803",
        "mapy": "37.5240",
        "sigungucode": "21",
        "cat1": "A02",
    },
]

# 방문자 수는 장소별 규모 차이를 만드는 값이다.
# 실데이터가 들어오면 단위가 달라져도 정제 단계에서 정규화하므로 문제없다.
_MOCK_VISITOR_STATS: list[dict] = [
    {"contentid": "mock-gyeongbokgung", "visitors": 82000},
    {"contentid": "mock-myeongdong", "visitors": 96000},
    {"contentid": "mock-seoul-forest", "visitors": 41000},
    {"contentid": "mock-national-museum", "visitors": 33000},
]


class MockKtoSource:
    """KTO 키가 없을 때 쓰는 대역. 응답 모양은 실제와 같게 맞춘다."""

    def fetch_places(self, *, area_code: int, content_type_id: int) -> list[RawPlace]:
        logger.info("mock KTO: 장소 %d건", len(_MOCK_PLACES))
        return [RawPlace(row) for row in _MOCK_PLACES]

    def fetch_visitor_stats(self) -> list[RawVisitorStat]:
        logger.info("mock KTO: 방문자 통계 %d건", len(_MOCK_VISITOR_STATS))
        return [RawVisitorStat(row) for row in _MOCK_VISITOR_STATS]


def get_kto_source() -> KtoSource:
    """설정을 보고 실제 클라이언트와 mock 중 하나를 고른다."""
    if settings.use_mock_kto:
        logger.warning("KTO_API_KEY 가 없어 mock 데이터로 동작합니다.")
        return MockKtoSource()
    return TourApiClient(settings.kto_api_key or "")


def classify_profile(name: str, category: str | None = None) -> str:
    """
    장소 이름·분류에서 유형을 추정한다.

    유형은 시간대 분포를 정하는 데 쓴다 — 궁은 폐장 후 0 으로 떨어지고
    거리는 저녁에 정점을 찍는다. 이 차이가 없으면 "언제 가면 여유로운지"라는
    판단 자체가 성립하지 않는다.
    """
    haystack = f"{name} {category or ''}"
    for profile, keywords in PROFILE_KEYWORDS.items():
        if any(keyword in haystack for keyword in keywords):
            return profile
    # 못 가리면 실내로 둔다. 야외로 오판하면 날씨 보정이 과하게 걸린다.
    return "indoor"
