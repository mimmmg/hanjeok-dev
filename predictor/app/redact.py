"""
로그에서 인증키를 가린다.

httpx 의 HTTPStatusError 메시지는 요청 URL 을 그대로 담는다. 우리 요청은
serviceKey·appid 를 쿼리스트링에 넣기 때문에, 예외를 그대로 로그에 남기면
인증키가 배포 로그에 쌓인다. 배포 플랫폼 로그는 여러 사람이 보고 오래 남는다.

httpx 로거를 WARNING 으로 올려도 이건 막히지 않는다 — 그쪽은 정상 요청 로그를
막는 것이고, 이건 우리가 직접 찍는 예외 메시지다.
"""

from __future__ import annotations

import re

# 가려야 할 쿼리 파라미터 이름들
_SECRET_PARAMS = ("serviceKey", "appid", "apikey", "api_key", "key")

_PATTERN = re.compile(
    r"(?i)\b(" + "|".join(_SECRET_PARAMS) + r")=([^&\s\'\"]+)"
)


def redact(text: object) -> str:
    """문자열에서 인증키 값을 ***** 로 바꾼다."""
    return _PATTERN.sub(lambda m: f"{m.group(1)}=*****", str(text))
