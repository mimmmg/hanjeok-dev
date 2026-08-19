"""
환경 설정. 값이 없어도 서비스가 뜨는 것을 원칙으로 한다.

키가 없으면 죽는 대신 mock 모드로 떨어진다. 예측 서비스가 못 뜨면
Next.js 는 마지막 저장분을 계속 읽으면 되지만(PRD ⑦ 가용성), 개발 중에
"키가 없어서 아무것도 못 해보는" 상태는 진행을 막는다.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from zoneinfo import ZoneInfo

# httpx 는 요청 URL 을 통째로 INFO 로 남긴다. 우리 요청은 serviceKey 가
# 쿼리스트링에 들어가므로 그대로 두면 인증키가 로그 파일에 쌓인다.
# 배포 플랫폼 로그는 여러 사람이 보고 오래 남으므로 여기서 막는다.
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# 서비스 지역이 서울 한정이므로 시간대도 서울로 고정한다.
# 배포 서버는 UTC 로 돌기 때문에 이 기준이 없으면 hour_slot 이 9시간 밀린다.
SEOUL_TZ = ZoneInfo("Asia/Seoul")

# KTO TourAPI 지역 코드 — 1 = 서울
KTO_AREA_CODE_SEOUL = 1
# 콘텐츠 타입 12 = 관광지 (맛집·숙박은 Won't 범위)
KTO_CONTENT_TYPE_TOURIST_SPOT = 12


@dataclass(frozen=True)
class Settings:
    supabase_url: str | None
    supabase_secret_key: str | None
    kto_api_key: str | None
    weather_api_key: str | None

    @property
    def can_write_db(self) -> bool:
        """Supabase 에 쓸 수 있는가. 배치가 의미를 가지려면 참이어야 한다."""
        return bool(self.supabase_url and self.supabase_secret_key)

    @property
    def use_mock_kto(self) -> bool:
        """KTO 키가 없으면 mock 데이터로 돈다."""
        return not self.kto_api_key

    @property
    def use_mock_weather(self) -> bool:
        return not self.weather_api_key


def load_settings() -> Settings:
    return Settings(
        supabase_url=os.getenv("SUPABASE_URL"),
        # 신형 secret key(sb_secret_...). 옛 이름도 받아준다.
        supabase_secret_key=(
            os.getenv("SUPABASE_SECRET_KEY")
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        ),
        kto_api_key=os.getenv("KTO_API_KEY"),
        weather_api_key=os.getenv("WEATHER_API_KEY"),
    )


settings = load_settings()
