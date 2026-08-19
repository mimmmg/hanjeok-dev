"""
실측 공공데이터 로더.

국가유산청 4대궁 관람객 일별 통계(2025년 365일)에서 두 가지를 뽑는다:

1. 요일 계수 — 토·일이 붐비고 월·화가 한산하다. 월·화가 낮은 건 궁 휴관일
   때문이다(경복궁 화요일, 나머지 월요일). 이게 없으면 토요일과 월요일을
   똑같이 예측한다.
2. 월 계수 — 10~11월과 4~5월이 정점, 2월과 7~8월이 최저.

두 계수는 궁 기준으로 뽑은 값이지만 다른 유형에도 적용한다.
"주말이 붐빈다", "단풍철이 붐빈다"는 궁에만 해당하는 얘기가 아니기 때문이다.
다만 궁의 휴관일 효과가 섞여 있어 월·화가 실제보다 낮게 잡힌다 —
장소별 휴무일 데이터가 생기면 그때 분리한다.

⚠️ PRD ② 는 "관광지 검색이 2·9·10월에 몰린다"고 적고 있는데, 실측 방문은
10·11월이 정점이고 2월이 최저다. 검색하는 시점과 실제 가는 시점이 다르다.
예측은 검색량이 아니라 방문량을 따라야 한다.
"""

from __future__ import annotations

import logging
from datetime import date
from functools import lru_cache
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PALACE_DAILY_CSV = DATA_DIR / "palace_visitors_daily.csv"

# 이 통계에 들어 있는 장소들. DB 의 place.name 과 이어붙이는 열쇠다.
PALACE_NAMES = ["경복궁", "창덕궁", "창경궁", "덕수궁", "종묘"]

# 계수가 튀는 것을 막는 범위. 표본이 한 해뿐이라 특정 요일에 연휴가 몰리면
# 계수가 과하게 커질 수 있다.
FACTOR_MIN, FACTOR_MAX = 0.6, 1.4


def _load_palace_daily() -> pd.DataFrame | None:
    if not PALACE_DAILY_CSV.exists():
        logger.warning("실측 통계 파일이 없습니다: %s", PALACE_DAILY_CSV)
        return None

    # 공공데이터포털 CSV 는 CP949 가 많다. UTF-8 로 저장된 경우도 있어 둘 다 시도한다.
    for encoding in ("cp949", "utf-8-sig"):
        try:
            df = pd.read_csv(PALACE_DAILY_CSV, encoding=encoding)
            break
        except UnicodeDecodeError:
            continue
    else:
        logger.error("실측 통계 인코딩을 판별하지 못했습니다.")
        return None

    df["일자"] = pd.to_datetime(df["일자"], errors="coerce")
    df = df.dropna(subset=["일자"])

    # 유료+무료 = 그 궁의 총 관람객
    for name in PALACE_NAMES:
        paid, free = f"{name}(유료)", f"{name}(무료)"
        if paid in df.columns and free in df.columns:
            df[name] = pd.to_numeric(df[paid], errors="coerce").fillna(0) + pd.to_numeric(
                df[free], errors="coerce"
            ).fillna(0)

    return df


def _clip(series: pd.Series) -> pd.Series:
    return series.clip(FACTOR_MIN, FACTOR_MAX)


@lru_cache(maxsize=1)
def weekday_factors() -> dict[int, float]:
    """요일(0=월 … 6=일) → 계수. 전체 평균이 1.0 이 되도록 맞춘다."""
    df = _load_palace_daily()
    if df is None:
        return {d: 1.0 for d in range(7)}

    total = df[[n for n in PALACE_NAMES if n in df.columns]].sum(axis=1)
    by_weekday = total.groupby(df["일자"].dt.dayofweek).mean()
    factors = _clip(by_weekday / total.mean())
    return {int(day): round(float(value), 3) for day, value in factors.items()}


@lru_cache(maxsize=1)
def month_factors() -> dict[int, float]:
    """월(1~12) → 계수."""
    df = _load_palace_daily()
    if df is None:
        return {m: 1.0 for m in range(1, 13)}

    total = df[[n for n in PALACE_NAMES if n in df.columns]].sum(axis=1)
    by_month = total.groupby(df["일자"].dt.month).mean()
    factors = _clip(by_month / total.mean())
    return {int(month): round(float(value), 3) for month, value in factors.items()}


@lru_cache(maxsize=1)
def measured_daily_visitors() -> dict[str, float]:
    """
    장소명 → 실측 일평균 관람객.

    이 값이 있는 장소는 추정 대신 실측으로 인기도를 매긴다.
    지금은 4대궁과 종묘 5곳뿐이지만, 추정값(중간값)보다 훨씬 낫다.
    """
    df = _load_palace_daily()
    if df is None:
        return {}
    return {
        name: float(df[name].mean())
        for name in PALACE_NAMES
        if name in df.columns
    }


# 요일·월 계수를 곱하면 최대 1.4 × 1.4 = 1.96 까지 간다. 그대로 두면
# 10월 토요일에 여러 장소가 한꺼번에 100 에 붙어 순위가 사라진다.
# 대안 비교는 "어디가 더 한적한가"를 가리는 화면이라 그 구분이 없으면
# 화면 자체가 쓸모없어진다. 곱한 뒤에도 한 번 더 묶는다.
COMBINED_FACTOR_MIN, COMBINED_FACTOR_MAX = 0.5, 1.5


def day_factor(target: date) -> float:
    """그날의 요일·월 계수를 합쳐 하나로 만든다."""
    combined = weekday_factors().get(target.weekday(), 1.0) * month_factors().get(
        target.month, 1.0
    )
    return max(COMBINED_FACTOR_MIN, min(COMBINED_FACTOR_MAX, combined))
