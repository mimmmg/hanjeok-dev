"""
Rule-based 혼잡 예측 (PRD ⑦).

구조:

    peak_level = 혼잡 × 0.6 + 이동 × 0.2 + 날씨 × 0.2      (0~100)
    congestion_pct(시각) = peak_level × 시간대_분포(시각)    (0~100)

가중합을 "그 장소가 오늘 얼마나 붐빌 것인가(peak_level)"에 쓰고, 시간대 분포를
따로 곱하는 이유가 있다. 가중합에 시간을 함께 섞으면 문 닫은 새벽에도
접근성·날씨 점수가 남아 궁이 15% 혼잡한 것처럼 나온다. 분포를 곱셈으로
분리하면 폐장 시간대는 확실히 0 이 된다.

세 항목의 뜻:
- 혼잡: 방문자 통계로 본 장소의 규모. 예측의 주된 근거라 비중이 가장 크다.
- 이동: 접근성. 역에서 가까울수록 사람이 더 몰린다.
- 날씨: 야외는 날이 좋을수록, 실내는 궂을수록 붐빈다. 방향이 반대다.

⚠️ 시간대 분포는 통계가 아니라 규칙이다. TourAPI 는 시간대별 방문자 수를
주지 않는다. 화면에서 "예측치"라고 표기하는 근거가 여기에 있다.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.weather import HourWeather

# 가중치 — 합이 1.0 이어야 한다
WEIGHT_CROWD = 0.6
WEIGHT_ACCESS = 0.2
WEIGHT_WEATHER = 0.2

# 장소 유형별 하루 분포 (0~23시, 0.0~1.0).
# peak_level 에 곱해지므로 1.0 인 시각이 그 장소의 정점이다.
HOUR_PROFILES: dict[str, list[float]] = {
    # 09시 개장 18시 폐장. 낮 정점 후 저녁에 0
    "palace": [
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.03, 0.11, 0.35, 0.63, 0.86,
        0.97, 0.94, 1.00, 0.92, 0.72, 0.47, 0.22, 0.07, 0.03, 0.01, 0.0, 0.0,
    ],
    # 저녁 정점. 밤늦게까지 이어지고 새벽에도 완전히 비지 않는다
    "street": [
        0.21, 0.12, 0.07, 0.04, 0.02, 0.02, 0.05, 0.09, 0.16, 0.24, 0.33, 0.45,
        0.56, 0.61, 0.65, 0.68, 0.73, 0.82, 0.94, 1.00, 0.96, 0.82, 0.59, 0.35,
    ],
    # 오후부터 올라 초저녁 정점
    "park": [
        0.07, 0.04, 0.03, 0.01, 0.01, 0.04, 0.11, 0.17, 0.21, 0.28, 0.39, 0.49,
        0.56, 0.63, 0.69, 0.72, 0.76, 0.83, 0.94, 1.00, 0.90, 0.67, 0.39, 0.17,
    ],
    # 실내 시설. 낮 정점, 밤 폐관
    "indoor": [
        0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.03, 0.16, 0.41, 0.65,
        0.78, 0.89, 0.97, 1.00, 0.95, 0.84, 0.74, 0.65, 0.51, 0.30, 0.08, 0.0,
    ],
}

# 야외 장소 — 날씨가 방문을 늘리는 쪽으로 작동한다
OUTDOOR_PROFILES = {"palace", "park", "street"}

# 사람이 가장 나다니기 좋은 기온대
COMFORT_MIN_C = 15.0
COMFORT_MAX_C = 25.0


def _clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def access_score(walk_minutes: int | None) -> float:
    """
    접근성 0~100. 역에서 가까울수록 높다 = 사람이 더 몰린다.

    web/utils/alternativeScore.ts 의 접근성 계산과 같은 기울기를 쓴다.
    두 곳이 어긋나면 "대안이 더 한적하다더니 막상 가보니 아니네"가 된다.
    """
    if walk_minutes is None:
        return 50.0  # 모르면 중간
    return _clamp(100.0 - walk_minutes * 5.0)


def weather_score(weather: HourWeather, profile: str) -> float:
    """
    그 시각 날씨가 방문을 얼마나 부추기는가. 0~100.

    야외와 실내의 방향이 반대다 — 비 오는 날 궁은 한산해지고
    박물관은 오히려 붐빈다. 이 반전이 없으면 비 예보에 모든 장소가
    한꺼번에 한적해지는 비현실적인 결과가 나온다.
    """
    # 기온: 쾌적 구간에서 100, 멀어질수록 감점
    if COMFORT_MIN_C <= weather.temperature <= COMFORT_MAX_C:
        temp_score = 100.0
    else:
        distance = (
            COMFORT_MIN_C - weather.temperature
            if weather.temperature < COMFORT_MIN_C
            else weather.temperature - COMFORT_MAX_C
        )
        temp_score = _clamp(100.0 - distance * 6.0)

    # 강수: 확률이 높을수록 야외 방문이 준다
    rain_penalty = weather.precipitation_prob  # 0~100
    outdoor_appeal = _clamp(temp_score - rain_penalty)

    if profile in OUTDOOR_PROFILES:
        return outdoor_appeal
    # 실내는 야외가 불쾌할수록 반사이익을 얻는다
    return _clamp(100.0 - outdoor_appeal)


@dataclass(frozen=True)
class HourForecast:
    hour_slot: int
    congestion_pct: int


# 날씨 보정의 최대 폭. 집중률이 이미 KTO 의 종합 예측이라, 날씨로 그 값을
# 크게 흔들면 원본 예측을 덮어쓰는 셈이 된다. ±15% 로 제한한다.
WEATHER_ADJUST_RANGE = 0.15


def score_from_concentration(
    *,
    concentration_rate: float,
    profile: str,
    hourly_weather: list[HourWeather],
) -> tuple[list[HourForecast], ScoreDetail]:
    """
    KTO 집중률을 기준으로 시간대별 혼잡도를 만든다.

        congestion_pct(시각) = 집중률 × 날씨보정 × 시간대분포(시각)

    집중률(cnctrRate)은 KTO 가 그 관광지의 향후 30일치를 직접 예측한 값이다.
    장소 인기도·요일·계절이 이미 다 반영돼 있어서(토요일에 98 이 나온다),
    우리가 그걸 다시 계산하면 이중 반영이 된다. 접근성도 마찬가지라 뺐다.

    우리가 더하는 것은 두 가지뿐이고, 둘 다 KTO 가 주지 않는 정보다:
    - 날씨 보정: 30일 앞 예측이 당일 비를 알 리 없다
    - 시간대 분포: 집중률은 일 단위다. "몇 시에 가면 여유로운가"는 없다

    이 구분이 서비스의 고유 가치가 어디에 있는지를 그대로 보여준다.
    """
    weather_by_hour = {w.hour_slot: w for w in hourly_weather}
    daytime = [weather_by_hour[h] for h in range(9, 21) if h in weather_by_hour]
    weather_avg = (
        sum(weather_score(w, profile) for w in daytime) / len(daytime)
        if daytime
        else 50.0
    )

    # 50점을 중립으로 보고 ±15% 범위에서만 움직인다
    weather_multiplier = 1.0 + ((weather_avg - 50.0) / 50.0) * WEATHER_ADJUST_RANGE
    daily_level = _clamp(concentration_rate * weather_multiplier)

    curve = HOUR_PROFILES.get(profile, HOUR_PROFILES["indoor"])
    forecasts = [
        HourForecast(
            hour_slot=hour,
            congestion_pct=int(round(_clamp(daily_level * ratio))),
        )
        for hour, ratio in enumerate(curve)
    ]

    return forecasts, ScoreDetail(
        crowd=round(concentration_rate, 1),
        access=0.0,  # 집중률에 이미 반영돼 있어 따로 더하지 않는다
        weather=round(weather_avg, 1),
        day_factor=round(weather_multiplier, 3),
        peak_level=round(daily_level, 1),
    )


@dataclass(frozen=True)
class ScoreDetail:
    """디버깅·설명용. 왜 이 숫자가 나왔는지 되짚을 수 있게 남긴다."""

    crowd: float
    access: float
    weather: float
    day_factor: float
    peak_level: float


def score_place_day(
    *,
    popularity: float,
    profile: str,
    walk_minutes: int | None,
    hourly_weather: list[HourWeather],
    day_factor: float = 1.0,
) -> tuple[list[HourForecast], ScoreDetail]:
    """
    한 장소의 하루치 시간대별 혼잡 예측치를 만든다.

    popularity: 방문자 통계를 0~1 로 정규화한 값 (transform.normalize_popularity)
    day_factor: 요일·계절 계수 (datasets.day_factor). 국가유산청 4대궁
        일별 실측에서 뽑은 값이다. 토요일은 1.34, 월요일은 0.56 —
        이 계수가 없으면 토요일과 월요일을 똑같이 예측한다.
    """
    crowd = _clamp(popularity * 100.0)
    access = access_score(walk_minutes)

    weather_by_hour = {w.hour_slot: w for w in hourly_weather}
    # 날씨는 시간마다 다르지만 peak_level 은 하루 하나여야 한다.
    # 그래서 사람이 실제로 움직이는 낮 시간대(9~20시) 평균을 대표값으로 쓴다.
    daytime = [weather_by_hour[h] for h in range(9, 21) if h in weather_by_hour]
    weather_avg = (
        sum(weather_score(w, profile) for w in daytime) / len(daytime)
        if daytime
        else 50.0
    )

    # 요일·계절은 가중합의 항목이 아니라 전체에 곱하는 계수다.
    # "토요일이라 20% 더 붐빈다"는 다른 항목과 더할 성질이 아니라
    # 그날 전체 수요를 키우고 줄이는 배율이기 때문이다.
    peak_level = _clamp(
        (crowd * WEIGHT_CROWD + access * WEIGHT_ACCESS + weather_avg * WEIGHT_WEATHER)
        * day_factor
    )

    curve = HOUR_PROFILES.get(profile, HOUR_PROFILES["indoor"])
    forecasts = [
        HourForecast(
            hour_slot=hour,
            congestion_pct=int(round(_clamp(peak_level * ratio))),
        )
        for hour, ratio in enumerate(curve)
    ]

    return forecasts, ScoreDetail(
        crowd=round(crowd, 1),
        access=round(access, 1),
        weather=round(weather_avg, 1),
        day_factor=round(day_factor, 3),
        peak_level=round(peak_level, 1),
    )
