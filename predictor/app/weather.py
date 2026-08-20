"""
날씨 수집기.

PRD ⑥ 에서 날씨는 테이블에 넣지 않고 API 호출로 처리하기로 했다.
실시간성이 강해 저장해두면 금방 낡기 때문이다.

제공자 셋을 준비하고 설정에 따라 고른다:
- 기상청 단기예보: 국내 예보의 원본. 정확도가 가장 높다. data.go.kr 키 필요
- OpenWeatherMap: 3시간 간격(무료 2.5). 키 필요
- Open-Meteo: 키가 필요 없다. 위 둘이 없을 때의 기본값

mock 은 네트워크가 아예 안 될 때의 마지막 수단이다. 키가 없다는 이유만으로
가짜 데이터를 쓰지는 않는다 — Open-Meteo 가 키 없이도 실제 예보를 주기 때문이다.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Protocol

import httpx

from app.config import SEOUL_TZ, settings
from app.redact import redact

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


def _fill_missing(
    by_hour: dict[int, HourWeather], fallback_temp: float = 20.0
) -> list[HourWeather]:
    """
    비어 있는 시간대를 앞뒤 값으로 채운다.

    예보는 발표 시각 이후만 오기 때문에 새벽 시간대가 비는 일이 흔하다.
    구멍이 있으면 그 시간대 날씨 보정이 중립(50)으로 떨어져,
    "새벽에만 유난히 다른 계산"이 되어버린다.
    """
    result: list[HourWeather] = []
    last: HourWeather | None = None
    for hour in range(24):
        current = by_hour.get(hour)
        if current is None:
            # 앞선 값이 있으면 그것을, 없으면 뒤에서 가장 가까운 값을 쓴다
            current = last or next(
                (by_hour[h] for h in range(hour + 1, 24) if h in by_hour),
                HourWeather(hour_slot=hour, temperature=fallback_temp, precipitation_prob=0),
            )
            current = HourWeather(
                hour_slot=hour,
                temperature=current.temperature,
                precipitation_prob=current.precipitation_prob,
            )
        result.append(current)
        last = current
    return result


# ──────────────────────────────────────────────────────────────
# ① 기상청 단기예보
# ──────────────────────────────────────────────────────────────
KMA_URL = (
    "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
)

# 발표 시각. 각 시각의 자료는 약 10분 뒤부터 제공된다.
KMA_BASE_TIMES = (2, 5, 8, 11, 14, 17, 20, 23)


def latlng_to_grid(lat: float, lng: float) -> tuple[int, int]:
    """
    위경도 → 기상청 격자(nx, ny). Lambert Conformal Conic 투영.

    기상청이 공개한 변환식을 그대로 옮긴 것이다. 상수는 기상청 격자 정의값이라
    의미를 따지지 말고 그대로 둔다.
    """
    RE, GRID = 6371.00877, 5.0
    SLAT1, SLAT2, OLON, OLAT = 30.0, 60.0, 126.0, 38.0
    XO, YO = 43, 136

    DEGRAD = math.pi / 180.0
    re = RE / GRID
    slat1, slat2 = SLAT1 * DEGRAD, SLAT2 * DEGRAD
    olon, olat = OLON * DEGRAD, OLAT * DEGRAD

    sn = math.tan(math.pi * 0.25 + slat2 * 0.5) / math.tan(
        math.pi * 0.25 + slat1 * 0.5
    )
    sn = math.log(math.cos(slat1) / math.cos(slat2)) / math.log(sn)
    sf = math.tan(math.pi * 0.25 + slat1 * 0.5)
    sf = (sf**sn) * math.cos(slat1) / sn
    ro = math.tan(math.pi * 0.25 + olat * 0.5)
    ro = re * sf / (ro**sn)

    ra = math.tan(math.pi * 0.25 + lat * DEGRAD * 0.5)
    ra = re * sf / (ra**sn)
    theta = lng * DEGRAD - olon
    if theta > math.pi:
        theta -= 2.0 * math.pi
    if theta < -math.pi:
        theta += 2.0 * math.pi
    theta *= sn

    nx = int(ra * math.sin(theta) + XO + 0.5)
    ny = int(ro - ra * math.cos(theta) + YO + 0.5)
    return nx, ny


def latest_kma_base(now: datetime) -> tuple[str, str]:
    """
    지금 받을 수 있는 가장 최근 발표 시각. (base_date, base_time)

    발표 직후 10분은 자료가 없어 실패하므로 한 타임 앞을 쓴다.
    """
    ref = now - timedelta(minutes=15)
    for hour in reversed(KMA_BASE_TIMES):
        if ref.hour >= hour:
            return ref.strftime("%Y%m%d"), f"{hour:02d}00"
    # 새벽 2시 전이면 전날 23시 발표를 쓴다
    prev = ref - timedelta(days=1)
    return prev.strftime("%Y%m%d"), "2300"


class KmaClient:
    """기상청 단기예보. TMP(기온)와 POP(강수확률)만 쓴다."""

    def __init__(self, api_key: str, timeout: float = 15.0) -> None:
        self._api_key = api_key
        self._timeout = timeout

    def fetch_hourly(self, *, lat: float, lng: float) -> list[HourWeather]:
        nx, ny = latlng_to_grid(lat, lng)
        base_date, base_time = latest_kma_base(datetime.now(SEOUL_TZ))

        with httpx.Client(timeout=self._timeout) as client:
            response = client.get(
                KMA_URL,
                params={
                    "serviceKey": self._api_key,
                    "dataType": "JSON",
                    # 하루치 TMP·POP 을 다 받으려면 넉넉해야 한다.
                    # 카테고리 12종 × 24시간이라 300 이면 충분하다.
                    "numOfRows": 300,
                    "pageNo": 1,
                    "base_date": base_date,
                    "base_time": base_time,
                    "nx": nx,
                    "ny": ny,
                },
            )
            response.raise_for_status()
            payload = response.json()

        header = payload.get("response", {}).get("header", {})
        if header.get("resultCode") not in ("00", "0000"):
            raise RuntimeError(f"기상청 응답 오류: {header.get('resultMsg')}")

        items = (
            payload.get("response", {})
            .get("body", {})
            .get("items", {})
            .get("item", [])
        )

        temps: dict[int, float] = {}
        pops: dict[int, int] = {}
        for item in items:
            try:
                hour = int(item["fcstTime"][:2]) % 24
                value = item["fcstValue"]
            except (KeyError, ValueError):
                continue
            if item.get("category") == "TMP":
                try:
                    temps[hour] = float(value)
                except ValueError:
                    continue
            elif item.get("category") == "POP":
                try:
                    pops[hour] = int(value)
                except ValueError:
                    continue

        if not temps:
            raise RuntimeError("기상청 응답에 기온(TMP)이 없습니다.")

        by_hour = {
            hour: HourWeather(
                hour_slot=hour,
                temperature=temp,
                precipitation_prob=pops.get(hour, 0),
            )
            for hour, temp in temps.items()
        }
        return _fill_missing(by_hour)


# ──────────────────────────────────────────────────────────────
# ② OpenWeatherMap (무료 2.5 forecast — 3시간 간격)
# ──────────────────────────────────────────────────────────────
class OpenWeatherClient:
    def __init__(self, api_key: str, timeout: float = 15.0) -> None:
        self._api_key = api_key
        self._timeout = timeout

    def fetch_hourly(self, *, lat: float, lng: float) -> list[HourWeather]:
        with httpx.Client(timeout=self._timeout) as client:
            response = client.get(
                "https://api.openweathermap.org/data/2.5/forecast",
                params={
                    "lat": lat,
                    "lon": lng,
                    "appid": self._api_key,
                    "units": "metric",
                    "cnt": 12,  # 3시간 × 12 = 36시간
                },
            )
            response.raise_for_status()
            payload = response.json()

        by_hour: dict[int, HourWeather] = {}
        for entry in payload.get("list", []):
            stamp = entry.get("dt_txt", "")
            try:
                hour = int(stamp[11:13])
            except ValueError:
                continue
            # pop 은 0~1 비율이라 100 을 곱한다
            by_hour[hour] = HourWeather(
                hour_slot=hour,
                temperature=float(entry["main"]["temp"]),
                precipitation_prob=int(round(float(entry.get("pop", 0)) * 100)),
            )

        if not by_hour:
            raise RuntimeError("OpenWeatherMap 응답이 비었습니다.")
        return _fill_missing(by_hour)


# ──────────────────────────────────────────────────────────────
# ③ Open-Meteo (키 불필요)
# ──────────────────────────────────────────────────────────────
class OpenMeteoClient:
    """
    키가 필요 없어 기본 제공자로 쓴다.

    기상청·OpenWeatherMap 키가 없어도 실제 예보를 받을 수 있으므로,
    "키가 없어서 가짜 날씨"라는 상황을 만들지 않는다.
    """

    def __init__(self, timeout: float = 15.0) -> None:
        self._timeout = timeout

    def fetch_hourly(self, *, lat: float, lng: float) -> list[HourWeather]:
        with httpx.Client(timeout=self._timeout) as client:
            response = client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lng,
                    "hourly": "temperature_2m,precipitation_probability",
                    "timezone": "Asia/Seoul",
                    "forecast_days": 1,
                },
            )
            response.raise_for_status()
            payload = response.json()

        hourly = payload.get("hourly", {})
        times = hourly.get("time", [])
        temps = hourly.get("temperature_2m", [])
        pops = hourly.get("precipitation_probability", [])

        by_hour: dict[int, HourWeather] = {}
        for index, stamp in enumerate(times):
            try:
                hour = int(stamp[11:13])
            except (ValueError, IndexError):
                continue
            by_hour[hour] = HourWeather(
                hour_slot=hour,
                temperature=float(temps[index]) if index < len(temps) else 20.0,
                precipitation_prob=int(pops[index]) if index < len(pops) else 0,
            )

        if not by_hour:
            raise RuntimeError("Open-Meteo 응답이 비었습니다.")
        return _fill_missing(by_hour)


# ──────────────────────────────────────────────────────────────
# ④ mock — 네트워크가 아예 안 될 때의 마지막 수단
# ──────────────────────────────────────────────────────────────
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
    provider = settings.weather_provider
    if provider == "kma":
        return KmaClient(settings.kma_api_key or "")
    if provider == "openweather":
        return OpenWeatherClient(settings.openweather_api_key or "")
    logger.info("날씨 키가 없어 Open-Meteo(키 불필요)로 동작합니다.")
    return OpenMeteoClient()


def fetch_hourly_safe(
    source: WeatherSource, *, lat: float, lng: float
) -> tuple[list[HourWeather], str | None]:
    """
    날씨를 받아오되 실패해도 배치를 죽이지 않는다.

    날씨는 스코어의 일부일 뿐이라, 못 받았다고 예측 전체를 포기하는 건
    과한 대응이다. 순서대로 물러난다: 지정된 제공자 → Open-Meteo → mock.
    무엇을 썼는지 호출한 쪽에 알려 결과에 함께 표시되게 한다 —
    조용히 mock 을 쓰는 게 제일 나쁘다.
    """
    try:
        return source.fetch_hourly(lat=lat, lng=lng), None
    except Exception as exc:  # noqa: BLE001 — 어떤 실패든 물러나서 계속 간다
        logger.warning("날씨 조회 실패(%s): %s", type(source).__name__, redact(exc))

    if not isinstance(source, OpenMeteoClient):
        try:
            data = OpenMeteoClient().fetch_hourly(lat=lat, lng=lng)
            return data, f"{type(source).__name__} 실패 → Open-Meteo 로 대체"
        except Exception as exc:  # noqa: BLE001
            logger.warning("Open-Meteo 도 실패: %s", redact(exc))

    return MockWeatherSource().fetch_hourly(lat=lat, lng=lng), "날씨 조회 실패 → mock 사용"
