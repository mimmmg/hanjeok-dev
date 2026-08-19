# 진행상황 — 크라우드 내비게이터(한적)

> 개발 진행 로그. 결정된 것과 다음에 할 일을 기록한다.
> 제품 근거는 `PRD.md`, 작업 규칙은 `CLAUDE.md` 참고.

최종 갱신: 2026-08-19

---

## 현재 상태

**Must 5개 화면 구현 완료 + 실데이터 연동 완료.** 로컬에서 전체 흐름이 동작한다.

```
랜딩 → 검색 → 결과(혼잡도·다중담기) → 상세(그래프·도보/차·길찾기)
                                          ↓
        관심 장소함(목록↔훑기·밀어서 해제)  ←  대안 비교(스코어 근거 노출)
```

---

## 화면 (6개)

| 경로 | 프로토타입 | 비고 |
|---|---|---|
| `/` | 01-landing | 정적. 상단 크롬 없음 |
| `/search` | 02-search | 정적. 데이터 조회 없음 |
| `/search/results?q=` | 03-results | 체크박스 다중담기, 한적한 순 정렬 |
| `/place/[id]` | 04-detail | recharts 그래프, 도보/차, 카카오맵 길찾기 |
| `/place/[id]/alternatives` | 05-alternatives | 스코어 계산식 노출 |
| `/favorites` | 06·07·08 | 목록↔훑기 토글, 밀어서 해제, 빈 상태 |

06·07·08은 프로토타입에선 HTML 3개지만 한 화면의 상태 차이라 한 페이지로 합쳤다.
하단 탭바(탐색·관심 장소함)는 **모든 화면에 고정**.

---

## 확정된 결정

| 항목 | 결정 |
|---|---|
| 저장소 | 한 저장소 두 폴더 (`web/`, `predictor/`). 작업 브랜치는 `dev` 하나 |
| Supabase | `hanjeok-dev` / ref `nqnxvhvozzstzloymovr` / ap-northeast-2 |
| Node / Python | 22 (`.nvmrc`) / 3.14.6 |
| 디자인 | 프로토타입 토큰을 Tailwind v4 `@theme` 로 이식. 여백은 Tailwind 기본 스케일과 동일해 옮기지 않음 |
| 화면 방향 | 모바일 우선(430px 프레임). **데스크톱 전용 2컬럼 레이아웃은 미착수** |
| 스와이프 | framer-motion 대신 CSS scroll-snap + 포인터 이벤트 |
| 차트 | 상세는 recharts, 나머지는 CSS |

---

## 데이터 (실데이터)

| 테이블 | 건수 | 출처 |
|---|---|---|
| `place` | 673곳 (좌표 289곳) | KTO 집중률 API 주도 + TourAPI 좌표 보강 |
| `congestion_forecast` | 113,064행 | 673곳 × 7일 × 24시간 |

**집중률 API가 장소 목록의 기준이다.** 예측할 수 있는 장소가 곧 보여줄 수 있는 장소이기 때문.
한때 TourAPI와의 교집합만 담았다가 경복궁·창덕궁·종묘·광화문이 전부 빠지는 사고가 있었다
(TourAPI 지역기반 목록에 이들이 없다). TourAPI에도 없는 주요 20곳은 `predictor/app/landmarks.py`에 좌표를 직접 적어뒀다.

좌표 없는 384곳도 저장한다 — 거리·대안 후보에서 빠질 뿐 검색·혼잡도·담기는 동작한다.

---

## 예측 로직

```
congestion_pct(시각) = KTO 집중률(일별) × 날씨보정(±15%) × 시간대분포(시각)
```

집중률에 장소 인기도·요일·계절·접근성이 이미 들어 있어 그것들을 다시 더하지 않는다.
**우리가 더하는 건 날씨 보정과 시간대 분포 둘뿐이고, 둘 다 KTO가 주지 않는 정보다.**

⚠️ 시간대 분포는 통계가 아니라 장소 유형별 규칙이다(궁·거리·공원·실내).
KTO는 일 단위만 준다. 화면에서 "예측치"라고 표기하는 근거가 여기에 있다.

배치는 APScheduler로 **서울 기준 04시·16시** 하루 두 번.

---

## 아키텍처

- 브라우저 → `/api/predict`(Next.js Route Handler) → FastAPI. **브라우저는 FastAPI 주소를 모른다** (HTML·JS 청크 전수 확인)
- 예측 서비스가 죽으면 `congestion_forecast` 저장분으로 폴백. 응답의 `source`로 구분
- 화면은 평소 DB를 직접 읽는다. Route Handler는 "가장 최신 값"이 필요할 때의 통로
- 위치 좌표는 **서버로 보내지 않고** 브라우저에서 거리 계산 후 폐기

---

## 아직 안 된 것

| 항목 | 상태 |
|---|---|
| **기상청 단기예보** | `KmaClient`가 빈 껍데기. mock 곡선으로 동작하며 실패 시 결과에 표시됨 |
| **데스크톱 레이아웃** | 미착수. 리스트+상세 2컬럼으로 별도 설계하기로 결정됨 |
| **임베드 지도** | 길찾기 링크만 있음. 화면 안 지도는 카카오맵 JS SDK 키 필요 |
| **장소 상세정보** | `access_desc`·`fee`가 대부분 비어 있음. TourAPI `detailIntro2` 연동 필요(장소당 1회 호출) |
| **배포** | Vercel Root Directory=`web` + 환경변수 3개 등록됨. `main` 머지 전이라 배포본은 옛 코드 |
| **날씨 표시** | 대안 카드에 "연동 예정"으로 표기 중 |

---

## 실행

```bash
# 프론트
cd web && nvm use && npm run dev            # localhost:3000

# 예측 서비스
cd predictor
set -a; . ./.env; set +a
./.venv/bin/uvicorn app.main:app --port 8000

# 배치 수동 실행
curl -X POST localhost:8000/jobs/sync-places   # 장소 동기화
curl -X POST localhost:8000/jobs/forecast      # 예측 갱신
```

---

## 환경변수

| 위치 | 변수 | 비고 |
|---|---|---|
| `web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 브라우저 노출 OK (RLS가 방어) |
| `web/.env.local` | `PREDICTOR_URL` (구 `PREDICTOR_API_URL`) | 서버 전용 |
| `predictor/.env` | `SUPABASE_SECRET_KEY` | `sb_secret_...`. RLS 우회 마스터 키 |
| `predictor/.env` | `KTO_API_KEY` | data.go.kr 인증키. TourAPI·집중률 공통 |
| `predictor/.env` | `WEATHER_API_KEY` | 있어도 `KmaClient` 미구현이라 mock으로 폴백 |
