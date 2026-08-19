"""
날씨 수집기.

PRD ⑥ 에서 날씨는 테이블에 넣지 않고 API 호출로 처리하기로 했다.
실시간성이 강해 저장해두면 금방 낡기 때문이다.

KTO 와 같은 방식으로 인터페이스를 먼저 잡고 mock 을 둔다.
기상청 단기예보 키가 생기면 KmaClient 만 채우면 된다.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Protocol

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class HourWeather:
    hour_slot: int
    """기온(℃)"""
    temperature: float
    """강수 확률 0~100"""
    precipitation_prob: int


class WeatherSource(Protocol):
    def fetch_hourly(self, *, lat: float, lng: float) -> list[HourWeather]:
        ...


class KmaClient:
    """기상청 단기예보. 키가 생기면 채운다."""

    def __init__(self, api_key: str) -> None:
        self._api_key = api_key

    def fetch_hourly(self, *, lat: float, lng: float) -> list[HourWeather]:
        raise NotImplementedError(
            "기상청 단기예보 연동이 아직 없습니다. WEATHER_API_KEY 를 비우면 "
            "mock 으로 동작합니다."
        )


class MockWeatherSource:
    """
    맑고 선선한 하루를 가정한다.

    값이 하루 종일 똑같으면 날씨 항목이 스코어에 아무 변화를 주지 않아
    가중합이 제대로 도는지 확인할 수 없다. 그래서 낮에 덥고 밤에 선선한
    실제와 비슷한 곡선을 준다.
    """

    def fetch_hourly(self, *, lat: float, lng: float) -> list[HourWeather]:
        temps = [
            18, 17, 17, 16, 16, 17, 19, 21, 23, 25, 27, 28,
            29, 30, 30, 29, 28, 26, 24, 23, 22, 21, 20, 19,
        ]
        return [
            HourWeather(hour_slot=hour, temperature=float(t), precipitation_prob=10)
            for hour, t in enumerate(temps)
        ]


def get_weather_source() -> WeatherSource:
    if settings.use_mock_weather:
        logger.warning("WEATHER_API_KEY 가 없어 mock 날씨로 동작합니다.")
        return MockWeatherSource()
    return KmaClient(settings.weather_api_key or "")


def fetch_hourly_safe(
    source: WeatherSource, *, lat: float, lng: float
) -> tuple[list[HourWeather], str | None]:
    """
    날씨를 받아오되 실패해도 배치를 죽이지 않는다.

    날씨는 스코어의 20% 항목일 뿐이라, 못 받았다고 예측 전체를 포기하는 건
    과한 대응이다. mock 으로 떨어뜨리고 그 사실을 호출한 쪽에 알려
    결과에 함께 표시되게 한다 — 조용히 mock 을 쓰는 게 제일 나쁘다.
    """
    try:
        return source.fetch_hourly(lat=lat, lng=lng), None
    except Exception as exc:  # noqa: BLE001 — 어떤 실패든 mock 으로 계속 간다
        logger.warning("날씨 조회 실패, mock 으로 대체합니다: %s", exc)
        return MockWeatherSource().fetch_hourly(lat=lat, lng=lng), str(exc)
