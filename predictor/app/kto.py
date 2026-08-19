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
# 관광지 집중률 방문자 추이 예측 정보 — 관광지별 향후 30일 집중률을 준다.
# 우리가 요일·계절 규칙으로 흉내 내던 것을 KTO 가 직접 예측해 주는 자료다.
CNCTR_API_BASE = "http://apis.data.go.kr/B551011/TatsCnctrRateService"

# 법정동 코드 기준 서울특별시
SEOUL_AREA_CD = "11"

# 서울 25개 자치구 (한국관광공사_OpenAPI_관광지_시군구_코드정보_v1.0.xlsx)
SEOUL_SIGUNGU_CODES: dict[str, str] = {
    "11110": "종로구", "11140": "중구", "11170": "용산구", "11200": "성동구",
    "11215": "광진구", "11230": "동대문구", "11260": "중랑구", "11290": "성북구",
    "11305": "강북구", "11320": "도봉구", "11350": "노원구", "11380": "은평구",
    "11410": "서대문구", "11440": "마포구", "11470": "양천구", "11500": "강서구",
    "11530": "구로구", "11545": "금천구", "11560": "영등포구", "11590": "동작구",
    "11620": "관악구", "11650": "서초구", "11680": "강남구", "11710": "송파구",
    "11740": "강동구",
}

# 구 이름 → 코드. 장소 하나의 집중률만 조회할 때 쓴다.
SIGUNGU_CODE_BY_NAME: dict[str, str] = {
    name: code for code, name in SEOUL_SIGUNGU_CODES.items()
}

# TourAPI 콘텐츠 타입. 집중률 목록에 박물관·미술관이 섞여 있어 문화시설도 받는다.
CONTENT_TYPE_TOURIST_SPOT = 12
CONTENT_TYPE_CULTURAL = 14

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
        # 집중률 API 가 이 역할을 대신하므로 더 이상 쓰지 않는다.
        return []

    def fetch_places_paged(
        self, *, area_code: int, content_type_id: int, page_size: int = 200
    ) -> list[RawPlace]:
        """전체 페이지를 돌며 장소를 모은다. 서울 관광지는 400여 건이라 2~3회다."""
        collected: list[RawPlace] = []
        page = 1
        while True:
            rows = self._get(
                "areaBasedList2",
                {
                    "areaCode": area_code,
                    "contentTypeId": content_type_id,
                    "numOfRows": page_size,
                    "pageNo": page,
                    "arrange": "A",
                },
            )
            if not rows:
                break
            collected.extend(RawPlace(row) for row in rows)
            if len(rows) < page_size:
                break
            page += 1
            if page > 20:  # 폭주 방지
                logger.warning("페이지 한도(20)에 걸려 중단합니다.")
                break
        return collected

    def fetch_concentration(self, *, signgu_cd: str) -> list[dict]:
        """
        한 자치구의 관광지별 향후 30일 집중률.

        한 번에 그 구의 모든 장소 × 30일이 오므로 구당 1회면 충분하다.
        종로구가 2,938행으로 가장 크다.
        """
        query = {
            "serviceKey": self._api_key,
            "MobileOS": "ETC",
            "MobileApp": "hanjeok",
            "_type": "json",
            "areaCd": SEOUL_AREA_CD,
            "signguCd": signgu_cd,
            "numOfRows": 5000,
            "pageNo": 1,
        }
        with httpx.Client(timeout=self._timeout) as client:
            response = client.get(
                f"{CNCTR_API_BASE}/tatsCnctrRatedList", params=query
            )
            response.raise_for_status()
            payload = response.json()

        body = payload.get("response", {}).get("body", {})
        items = body.get("items")
        if not items:
            logger.warning("집중률 응답에 items 없음 (구 %s)", signgu_cd)
            return []
        return items.get("item", [])


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
