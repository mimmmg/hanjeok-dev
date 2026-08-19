"""
원본 데이터 정제 (pandas).

TourAPI 응답은 문자열 위주에 결측이 흔하다 (mapx 가 빈 문자열이거나
sigungucode 가 없는 등). 스코어링이 이런 걸 매번 방어하면 로직이 지저분해지므로
여기서 한 번에 정리한다.

정제 결과는 "장소 한 건 = 한 행"인 DataFrame 이고, 스코어링은 이 모양만 안다.
나중에 데이터 출처가 바뀌어도 이 함수의 출력만 맞추면 뒷단은 그대로다.
"""

from __future__ import annotations

import logging

import pandas as pd

from app.kto import RawPlace, RawVisitorStat, classify_profile

logger = logging.getLogger(__name__)

# TourAPI sigungucode → 구 이름. 서울(areaCode=1) 기준 일부만 담았다.
# 실제 키가 생기면 코드표 전체를 받아 채운다.
SEOUL_SIGUNGU: dict[str, str] = {
    "1": "강남구", "2": "강동구", "3": "강북구", "4": "강서구",
    "5": "관악구", "6": "광진구", "7": "구로구", "8": "금천구",
    "9": "노원구", "10": "도봉구", "11": "동대문구", "12": "동작구",
    "13": "마포구", "14": "서대문구", "15": "서초구", "16": "성동구",
    "17": "성북구", "18": "송파구", "19": "양천구", "20": "영등포구",
    "21": "용산구", "22": "은평구", "23": "종로구", "24": "중구",
    "25": "중랑구",
}

# 정제 후 보장되는 컬럼
PLACE_COLUMNS = [
    "kto_content_id",
    "name",
    "district",
    "address",
    "lat",
    "lng",
    "profile",
    "visitors",
]


def _to_float(value: object) -> float | None:
    """빈 문자열·None·'0' 을 전부 결측으로 취급한다."""
    try:
        number = float(str(value).strip())
    except (TypeError, ValueError):
        return None
    # TourAPI 는 좌표를 모를 때 0 을 준다. 아프리카 앞바다로 찍히면 안 된다.
    return number if number != 0 else None


def clean_places(
    raw_places: list[RawPlace],
    raw_stats: list[RawVisitorStat] | None = None,
) -> pd.DataFrame:
    """원본 장소 목록을 스코어링이 바로 쓸 수 있는 DataFrame 으로 만든다."""
    if not raw_places:
        return pd.DataFrame(columns=PLACE_COLUMNS)

    df = pd.DataFrame(raw_places)

    out = pd.DataFrame()
    out["kto_content_id"] = df.get("contentid", pd.Series(dtype=str)).astype(str)
    out["name"] = df.get("title", pd.Series(dtype=str)).astype(str).str.strip()
    out["address"] = df.get("addr1", pd.Series(dtype=str)).fillna("").astype(str)

    # TourAPI 는 mapx=경도, mapy=위도다. 뒤집으면 서울이 아니라 남극이 된다.
    out["lng"] = df.get("mapx", pd.Series(dtype=object)).map(_to_float)
    out["lat"] = df.get("mapy", pd.Series(dtype=object)).map(_to_float)

    out["district"] = (
        df.get("sigungucode", pd.Series(dtype=object))
        .astype(str)
        .map(SEOUL_SIGUNGU)
    )

    out["profile"] = [
        classify_profile(name, category)
        for name, category in zip(
            out["name"],
            df.get("cat1", pd.Series([None] * len(df))),
        )
    ]

    # ── 방문자 통계 결합 ──
    if raw_stats:
        stats = pd.DataFrame(raw_stats)
        stats["kto_content_id"] = stats["contentid"].astype(str)
        stats = stats[["kto_content_id", "visitors"]]
        out = out.merge(stats, on="kto_content_id", how="left")
    else:
        out["visitors"] = pd.NA

    # 통계가 없는 장소는 중간값으로 둔다. 0 으로 두면 "아무도 안 가는 곳"이
    # 되어 부당하게 한적한 곳으로 추천된다.
    visitors = pd.to_numeric(out["visitors"], errors="coerce")
    out["visitors"] = visitors.fillna(visitors.median() if visitors.notna().any() else 0)

    # 이름과 좌표가 없으면 화면에서 쓸 수 없다. 조용히 버리지 않고 남긴다.
    before = len(out)
    out = out[out["name"].str.len() > 0]
    out = out.dropna(subset=["lat", "lng"])
    dropped = before - len(out)
    if dropped:
        logger.warning("좌표·이름 결측으로 %d건 제외", dropped)

    # 같은 장소가 여러 번 올 수 있다 (페이지 경계 등)
    out = out.drop_duplicates(subset=["kto_content_id"], keep="first")

    return out[PLACE_COLUMNS].reset_index(drop=True)


# 가장 한산한 관광지도 완전히 비어 있지는 않다. 정규화 하한을 둬서
# 최하위 장소가 "아무도 안 가는 곳"으로 취급되는 것을 막는다.
# 이 하한이 없으면 방문객 3만 명인 박물관이 혼잡 0 점을 받아
# 대안 추천에서 부당하게 1순위로 올라온다.
POPULARITY_FLOOR = 0.15


def normalize_popularity(df: pd.DataFrame) -> pd.Series:
    """
    방문자 수를 0.15~1 로 정규화해 "이 장소가 얼마나 붐비는 편인가"를 만든다.

    최소·최대로 나누는 대신 분위수를 쓴다. 명동 하나가 유난히 크면
    나머지가 전부 0 근처로 눌려 장소 간 차이가 사라지기 때문이다.
    """
    visitors = pd.to_numeric(df["visitors"], errors="coerce").fillna(0)
    if len(visitors) < 2 or visitors.nunique() < 2:
        # 비교할 대상이 없으면 전부 중간으로 둔다
        return pd.Series([0.5] * len(df), index=df.index)

    low = visitors.quantile(0.10)
    high = visitors.quantile(0.90)
    if high <= low:
        return pd.Series([0.5] * len(df), index=df.index)

    scaled = ((visitors - low) / (high - low)).clip(0, 1)
    return POPULARITY_FLOOR + scaled * (1.0 - POPULARITY_FLOOR)
