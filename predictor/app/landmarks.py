"""
TourAPI 에 없는 주요 관광지의 좌표와 기본정보.

집중률 API 에는 경복궁·창덕궁·종묘·광화문·덕수궁이 있는데 TourAPI
KorService2 에는 아예 없다(창경궁·경희궁은 있다). 이유는 알 수 없지만
데이터가 그렇다. 그대로 두면 서울에서 가장 유명한 곳들이 검색되지 않고,
검색돼도 이용시간·입장료 같은 기본정보가 통째로 빈다.

TourAPI 를 부를 수 없는 장소들이라 여기에 직접 적는다. 목록은 짧게 유지한다 —
길어지면 결국 손으로 관리하는 장소 마스터가 되어버린다.

휴무일은 화면 표시용만이 아니다. 예측 배치가 이 값을 읽어 휴무일 혼잡도를
0 으로 만든다(restdays.py). 궁의 휴관일에 "여유로운 곳"으로 추천되는 게
가장 큰 사고다 — 경복궁은 화요일, 나머지 궁·종묘는 월요일에 닫는다.

이름은 집중률 API 의 tAtsNm 표기를 그대로 쓴다. 붙이는 열쇠가 그 이름이다.
"""

from __future__ import annotations

from typing import TypedDict


class LandmarkInfo(TypedDict, total=False):
    lat: float
    lng: float
    address: str
    use_time: str
    rest_date: str
    fee: str
    parking: str
    info_center: str


LANDMARKS: dict[str, LandmarkInfo] = {
    "경복궁": {
        "lat": 37.5796,
        "lng": 126.9770,
        "address": "서울 종로구 사직로 161",
        "use_time": "09:00~18:00 (관람 종료 1시간 전까지 입장)",
        "rest_date": "매주 화요일",
        "fee": "3,000원 (한복 착용 시 무료)",
        "parking": "가능 (유료)",
        "info_center": "경복궁 관리소 02-3700-3900",
    },
    "창덕궁과 후원 [유네스코 세계유산]": {
        "lat": 37.5794,
        "lng": 126.9910,
        "address": "서울 종로구 율곡로 99",
        "use_time": "09:00~18:00 (후원은 시간제 관람)",
        "rest_date": "매주 월요일",
        "fee": "3,000원 (후원 별도 5,000원)",
        "parking": "가능 (유료)",
        "info_center": "창덕궁 관리소 02-3668-2300",
    },
    "종묘 [유네스코 세계유산]": {
        "lat": 37.5745,
        "lng": 126.9940,
        "address": "서울 종로구 종로 157",
        "use_time": "09:00~18:00",
        "rest_date": "매주 화요일",
        "fee": "1,000원",
        "parking": "가능 (유료)",
        "info_center": "종묘 관리소 02-765-0195",
    },
    "덕수궁": {
        "lat": 37.5658,
        "lng": 126.9751,
        "address": "서울 중구 세종대로 99",
        "use_time": "09:00~21:00",
        "rest_date": "매주 월요일",
        "fee": "1,000원",
        "parking": "불가능",
        "info_center": "덕수궁 관리소 02-771-9951",
    },
    "광화문": {
        "lat": 37.5760,
        "lng": 126.9769,
        "address": "서울 종로구 사직로 161",
        "use_time": "상시 개방 (수문장 교대의식 10:00·14:00)",
        "rest_date": "연중무휴",
        "fee": "무료",
        "parking": "불가능",
    },
    "광화문광장": {
        "lat": 37.5725,
        "lng": 126.9769,
        "address": "서울 종로구 세종대로 172",
        "use_time": "상시 개방",
        "rest_date": "연중무휴",
        "fee": "무료",
        "parking": "불가능",
    },
    "청와대": {
        "lat": 37.5866,
        "lng": 126.9749,
        "address": "서울 종로구 청와대로 1",
        "use_time": "09:00~18:00 (관람 신청 필요)",
        "rest_date": "매주 화요일",
        "fee": "무료",
        "parking": "불가능",
    },
    "N서울타워": {
        "lat": 37.5512,
        "lng": 126.9882,
        "address": "서울 용산구 남산공원길 105",
        "use_time": "10:00~23:00",
        "rest_date": "연중무휴",
        "fee": "전망대 21,000원",
        "parking": "가능 (유료)",
    },
    "롯데월드타워 서울스카이": {
        "lat": 37.5125,
        "lng": 127.1025,
        "address": "서울 송파구 올림픽로 300",
        "use_time": "10:00~22:00",
        "rest_date": "연중무휴",
        "fee": "전망대 29,000원",
        "parking": "가능 (유료)",
    },
    "동대문디자인플라자(DDP)": {
        "lat": 37.5669,
        "lng": 127.0095,
        "address": "서울 중구 을지로 281",
        "use_time": "10:00~20:00 (전시별 상이)",
        "rest_date": "연중무휴",
        "fee": "무료 (전시 별도)",
        "parking": "가능 (유료)",
    },
    "명동": {"lat": 37.5636, "lng": 126.9827},
    "이태원": {"lat": 37.5346, "lng": 126.9946},
    "홍대": {"lat": 37.5563, "lng": 126.9236},
    "강남역": {"lat": 37.4979, "lng": 127.0276},
    "여의도 한강공원": {"lat": 37.5285, "lng": 126.9327},
    "반포한강공원": {"lat": 37.5100, "lng": 126.9958},
    "olympic공원": {"lat": 37.5202, "lng": 127.1216},
    "서울숲": {"lat": 37.5444, "lng": 127.0374},
    "청계천": {"lat": 37.5696, "lng": 126.9787},
    "남대문시장": {"lat": 37.5590, "lng": 126.9776},
}

# 좌표만 필요한 곳에서 쓰는 뷰
LANDMARK_COORDS: dict[str, tuple[float, float]] = {
    name: (info["lat"], info["lng"])
    for name, info in LANDMARKS.items()
    if "lat" in info and "lng" in info
}
