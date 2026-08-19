# 한적 — 혼잡 예측 서비스 (predictor)

서울 관광지의 시간대별 혼잡도를 계산해 Supabase `congestion_forecast` 테이블에
저장하는 배치 서비스. PRD ⑦의 투 서비스 구조에서 "예측 전담" 쪽이다.

**브라우저는 이 서비스를 직접 호출하지 않는다.** Next.js 서버만 호출하고,
화면은 계산 결과가 아니라 `congestion_forecast` 테이블을 읽는다. 그래서 이
서비스가 죽어도 검색·즐겨찾기는 그대로 동작한다.

---

## 빠른 시작

```bash
cd predictor

# 1. 가상환경 (이미 있으면 건너뛴다)
python3 -m venv .venv
./.venv/bin/pip install -r requirements.txt

# 2. 환경변수
cp .env.example .env      # 값을 채운다. 비워도 mock 으로 돈다

# 3. 실행
set -a; . ./.env; set +a
./.venv/bin/uvicorn app.main:app --reload --port 8000
```

`http://127.0.0.1:8000/docs` 에서 API 문서를 볼 수 있다.

### 키 없이 돌려보기

키가 하나도 없어도 뜬다. KTO·날씨는 mock 으로 떨어지고 저장만 건너뛴다.
개발 중에 "키가 없어서 아무것도 못 해보는" 상태를 만들지 않기 위한 설계다.

```bash
./.venv/bin/python -c "
from app.jobs import run_forecast_job
print(run_forecast_job(dry_run=True))
"
```

---

## 환경변수

| 이름 | 없으면 | 용도 |
|---|---|---|
| `SUPABASE_URL` | 저장 건너뜀 | 프로젝트 주소 |
| `SUPABASE_SECRET_KEY` | 저장 건너뜀 | `sb_secret_...`. RLS 를 우회해 예측치를 쓴다 |
| `KTO_API_KEY` | mock 데이터 | 한국관광공사 TourAPI 인증키 |
| `WEATHER_API_KEY` | mock 날씨 | 기상청 단기예보 인증키 |

`SUPABASE_SECRET_KEY` 는 RLS 를 통째로 우회하는 키다. **이 서비스만 갖는다.**
Next.js 나 브라우저로 절대 넘기지 않는다.

---

## 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| GET | `/health` | 생존 확인. 어떤 mock 이 켜져 있는지도 알려준다 |
| POST | `/jobs/forecast` | 배치를 지금 실행. `?dry_run=true` 면 계산만 |
| GET | `/forecast?place_id=` | 한 장소를 그 자리에서 계산 (디버깅용) |

`/forecast` 는 화면이 읽는 경로가 아니다. 화면은 테이블을 읽는다.
이 엔드포인트는 "저장된 값이 왜 저렇게 나왔나"를 확인할 때 쓴다.

---

## 배치 동작

```
수집(kto.py) → 정제(transform.py) → 스코어링(scoring.py) → 저장(store.py)
```

APScheduler 가 **서울 기준 04시·16시** 하루 두 번 실행한다. 새벽은 그날치를
미리 채우고, 오후는 날씨가 바뀐 경우를 반영한다.

실시간 계산이 아니라 사전 계산인 이유는 응답 속도 때문만이 아니다. 결과가
테이블에 남아 있어야 이 서비스가 죽어도 화면이 멈추지 않는다.

### 스코어링

```
peak_level = 혼잡 × 0.6 + 이동 × 0.2 + 날씨 × 0.2      (0~100)
congestion_pct(시각) = peak_level × 시간대_분포(시각)
```

가중합을 "오늘 얼마나 붐빌 것인가"에 쓰고 시간대 분포를 따로 곱한다.
가중합에 시간을 함께 섞으면 문 닫은 새벽에도 접근성·날씨 점수가 남아
궁이 15% 혼잡한 것처럼 나온다. 곱셈으로 분리해야 폐장 시간대가 0 이 된다.

- **혼잡**: 방문자 통계로 본 장소 규모. 주된 근거라 비중이 가장 크다
- **이동**: 접근성. 역에서 가까울수록 사람이 더 몰린다
- **날씨**: 야외는 날이 좋을수록, 실내는 궂을수록 붐빈다 — 방향이 반대다

시간대 분포는 장소 유형(궁·거리·공원·실내)별 규칙이다.

> ⚠️ **시간대 분포는 통계가 아니라 규칙이다.** TourAPI 는 시간대별 방문자 수를
> 주지 않는다. 화면에서 "예측치"라고 표기하는 근거가 여기에 있다.

---

## 아직 mock 인 것

| 항목 | 상태 | 필요한 것 |
|---|---|---|
| 장소 목록 | mock 4곳 | TourAPI 인증키 → `kto.TourApiClient.fetch_places` 동작 |
| 방문자 통계 | mock | 한국관광 데이터랩 관광지점별 입장객 통계 |
| 날씨 | 맑음 고정 곡선 | 기상청 단기예보 키 → `weather.KmaClient` 채우기 |

인터페이스(`KtoSource`, `WeatherSource`)를 먼저 잡아둬서, 실제 구현을 채워도
정제·스코어링·저장 코드는 손대지 않는다.

---

## 배포 (Render / Railway)

- Root Directory: `predictor`
- Build: `pip install -r requirements.txt`
- Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- 환경변수는 위 표대로 등록

무료 플랜은 유휴 시 인스턴스를 재우는 경우가 있어 스케줄러가 멈출 수 있다.
그때는 플랫폼의 Cron 기능으로 `POST /jobs/forecast` 를 대신 호출한다.
