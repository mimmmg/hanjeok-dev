"""
휴무일 판정.

TourAPI 의 restdate 는 자유 문장이다. "매주 월요일", "연중무휴",
"1월 1일, 설날·추석 당일" 처럼 형식이 제각각이라 완전한 파싱은 불가능하다.

그래서 목표를 좁혔다 — **요일 단위 정기 휴무만** 읽는다. 이것만으로도
가장 큰 사고를 막는다: 궁·박물관의 월·화 휴관일에 혼잡도 0 이 아닌 값이
나와서 "여유로운 곳"으로 추천되는 일이다.

읽지 못한 문장은 "휴무일 모름"으로 두고 예측을 그대로 진행한다.
잘못 읽어 문 연 날을 닫혔다고 하는 쪽이 더 나쁘다.
"""

from __future__ import annotations

import re
from datetime import date

# 월=0 … 일=6 (date.weekday() 와 같은 기준)
_WEEKDAY_INDEX = {
    "월": 0,
    "화": 1,
    "수": 2,
    "목": 3,
    "금": 4,
    "토": 5,
    "일": 6,
}

# "매주 월요일", "매주 월~화요일", "매주 월요일, 화요일"
_WEEKLY = re.compile(r"매주\s*([월화수목금토일][^.。\n]*)")
_RANGE = re.compile(r"([월화수목금토일])\s*[~-]\s*([월화수목금토일])")

# 요일 글자와 구분자(~ - , · 및 공백)만 이어지는 앞부분.
# 뒤에 붙는 설명("(공휴일인 경우 다음날)")을 잘라내는 역할이다.
_WEEKDAY_RUN = re.compile(r"[월화수목금토일~\-,·및\s]+")

# 이 말이 있으면 정기 휴무가 없다고 본다
_NO_CLOSURE = ("연중무휴", "상시", "무휴", "연중개방")


def parse_closed_weekdays(rest_date: str | None) -> frozenset[int]:
    """
    휴무일 문장에서 정기 휴무 요일을 읽는다. 못 읽으면 빈 집합.

    빈 집합은 "휴무일 없음"이 아니라 "요일 단위 정기 휴무를 못 찾음"이다.
    둘을 구분할 필요가 생기면 그때 반환형을 늘린다.
    """
    if not rest_date:
        return frozenset()

    text = rest_date.replace(" ", "")
    if any(keyword in text for keyword in _NO_CLOSURE):
        return frozenset()

    match = _WEEKLY.search(rest_date)
    if not match:
        return frozenset()

    # "요일" 이라는 말 자체에 '일'이 들어 있어, 글자만 훑으면
    # "매주 월요일"이 월요일과 일요일 둘로 읽힌다.
    # "토요일~일요일"은 '일~일'로 잡혀 토요일이 빠진다.
    # 먼저 "요일"을 지운다.
    cleaned = match.group(1).replace("요일", "")

    # 그다음 요일 글자와 구분자만 이어지는 앞부분까지만 읽는다.
    # "매주 월요일(공휴일인 경우 다음날)" 처럼 뒤에 설명이 붙으면
    # "공휴일"·"다음날"의 '일'까지 일요일로 오인하기 때문이다.
    prefix = _WEEKDAY_RUN.match(cleaned)
    segment = prefix.group(0) if prefix else ""
    days: set[int] = set()

    # "월~수요일" 같은 범위를 먼저 펼친다
    for start, end in _RANGE.findall(segment):
        s, e = _WEEKDAY_INDEX[start], _WEEKDAY_INDEX[end]
        # 일요일을 넘어가는 범위(토~월)도 감싸서 처리한다
        current = s
        while True:
            days.add(current)
            if current == e:
                break
            current = (current + 1) % 7

    # 범위가 없으면 나열된 요일을 그대로 읽는다
    if not days:
        for char in segment:
            if char in _WEEKDAY_INDEX:
                days.add(_WEEKDAY_INDEX[char])

    return frozenset(days)


def is_closed_on(rest_date: str | None, target: date) -> bool:
    """그 날짜에 정기 휴무인가."""
    return target.weekday() in parse_closed_weekdays(rest_date)
