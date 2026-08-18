# 진행상황 — 크라우드 내비게이터(한적)

> 개발 진행 로그. 결정된 것과 다음에 할 일을 기록한다.
> 제품 근거는 `PRD.md`, 작업 규칙은 `CLAUDE.md` 참고.

최종 갱신: 2026-08-18

---

## 현재 단계

**뼈대(워킹 스켈레톤) 5단계 전부 완료.** 브라우저 → Next.js → Supabase / FastAPI 경로가 실제로 뚫린 것을 확인했다.
다음은 화면 구현 단계.

---

## 확정된 결정

| 항목 | 결정 | 비고 |
|---|---|---|
| 저장소 구조 | **한 저장소에 두 폴더** (`web/`, `predictor/`) | Vercel Root Directory = `web/`, Render/Railway = `predictor/`. Turborepo·pnpm workspace 미도입 |
| Supabase 프로젝트 | **`hanjeok-dev`** / ref `nqnxvhvozzstzloymovr` / **ap-northeast-2(서울)** | 수업 실습물(`vibe-app-project`)과 분리하려고 새로 생성. 무료 $0 |
| 스키마 관리 | Supabase MCP로 마이그레이션 적용 | `.mcp.json`이 저장소에 있음(토큰 없음, OAuth) |
| 화면 방향 | **모바일은 프로토타입 그대로**(430px 앱 화면), **데스크톱은 전용 레이아웃 별도 설계**(리스트+상세 2컬럼) | 단, 구현 순서는 **모바일 먼저** — 검증 대상 흐름이 모바일에 있음 |
| Node 버전 | **22** (`.nvmrc`로 고정) | Next.js 16은 `>=20.9.0` 요구. `nvm use`로 자동 전환 |
| Python 버전 | **3.14.6** | pandas 3.0.5가 cp314 휠 제공 확인함 |
| KTO 데이터 | API 키 발급 완료. 필요한 데이터를 요청하면 사용자가 내려받아 제공 | |

---

## 뼈대 구축 5단계 — 전부 완료

- [x] **1. Supabase 프로젝트 + 3테이블 DDL** — RLS·UNIQUE·check 제약·인덱스까지 적용, 보안 경고 0건
- [x] **2. `web/` 생성** — Next.js 16.3.1 / React 19.2.8 / Tailwind v4 / TS strict
- [x] **3. Supabase 연결 + 익명 인증** — 서버 조회 성공, 익명 uid 발급 확인
- [x] **4. `predictor/` 생성** — FastAPI 0.141.1, `/health` + `/forecast` 더미 곡선
- [x] **5. 연결부 관통** — 화면에서 예측치 24개 시간대 수신, 최다 혼잡 14시 78% 표시
- [x] **가용성 검증** — 예측 서버를 죽여도 페이지 200 + Supabase 정상, 예측 영역만 실패 표시 (PRD ⑦ 요구 충족)

### 실제 폴더 구조

```
hanjeok-dev/
├─ CLAUDE.md / PRD.md / PROGRESS.md / .nvmrc / .mcp.json
├─ prototype/              # 화면 8종 (빌드 제외)
├─ web/                    # Next.js — Vercel
│  ├─ app/
│  │  ├─ layout.tsx        # lang="ko", 메타데이터
│  │  ├─ page.tsx          # [임시] 뼈대 진단 화면
│  │  └─ api/congestion/route.ts   # FastAPI 중계
│  ├─ components/AnonAuthProbe.tsx  # [임시]
│  ├─ utils/
│  │  ├─ supabase/{client,server,updateSession,ensureAnonymousUser}.ts
│  │  └─ predictor.ts      # FastAPI 호출 (서버 전용, 5초 타임아웃)
│  ├─ types/{database,forecast}.ts
│  ├─ proxy.ts             # Next 16 규약 (구 middleware.ts)
│  └─ .env.local / .env.example
└─ predictor/              # FastAPI — Render/Railway
   ├─ app/main.py          # /health, /forecast
   ├─ requirements.txt
   └─ .env.example
```

`lib/` 폴더는 만들지 않는다 — "타입별 분리" 규칙에 따라 클라이언트류는 전부 `utils/` 아래.

### 실행 방법

```bash
# 프론트
cd web && nvm use && npm run dev          # localhost:3000

# 예측 서비스
cd predictor && ./.venv/bin/uvicorn app.main:app --port 8000
```

### 환경변수

| 위치 | 변수 | 브라우저 노출 |
|---|---|---|
| `web/.env.local` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 노출 OK (RLS가 방어) |
| `web/.env.local` | `PREDICTOR_API_URL` | **금지** — `NEXT_PUBLIC_` 절대 붙이지 않음 |
| `predictor/.env` | `SUPABASE_SERVICE_ROLE_KEY`, `KTO_API_KEY` | 서버 전용. service_role은 RLS 우회 마스터 키 |

---

## 구현 중 내린 판단 (기억해둘 것)

- **익명 계정 발급 시점**: `proxy.ts`는 세션 **갱신만** 하고, 계정 발급은 사용자가 처음 장소를 담을 때 `ensureAnonymousUser()`가 한다. 방문마다 발급하면 크롤러·봇 트래픽으로 `auth.users`에 빈 계정이 쌓인다.
- **Next.js 16 breaking change**: `middleware.ts` → **`proxy.ts`** 로 이름이 바뀌었고 export도 `proxy`. `cookies()`는 **async**. Supabase 공식 문서는 아직 middleware 기준이라 그대로 복사하면 동작하지 않는다.
- **`web/AGENTS.md`·`web/CLAUDE.md`** 는 `next dev`가 자동 생성한다. 지워도 다시 생기므로 커밋해서 트리를 깨끗하게 유지한다.
- **hydration mismatch 경고**는 Bitdefender 안티트래커 브라우저 확장이 원인(`bis_skin_checked` 속성 주입). 코드 문제 아님. 시크릿 창에서는 안 뜬다.

---

## 다음 할 일

1. **KTO 시드 데이터 확보 → `place` 테이블 채우기** (아래 요청 참고)
2. **프로토타입 디자인 토큰을 Tailwind v4 `@theme`로 이식** — `prototype/style.css`의 `:root` 변수를 거의 그대로 옮길 수 있음
3. **모바일 화면 구현** (검색 → 결과 → 상세 → 대안 → 관심 장소함)
4. 이후 데스크톱 전용 레이아웃
5. 임시 파일 정리: `app/page.tsx`, `components/AnonAuthProbe.tsx`

---

## KTO 데이터 요청 현황

### 지금 필요 — 서울 관광지 목록 (Place 시드용)

TourAPI `areaBasedList` 엔드포인트:

| 파라미터 | 값 |
|---|---|
| `areaCode` | `1` (서울) |
| `contentTypeId` | `12` (관광지) |
| 필요 필드 | `title`, `addr1`, `mapx`, `mapy`, `sigungucode`, `contentid` |

→ Place의 `name` / `address` / `lng` / `lat` / `district` / `kto_content_id`에 매핑. JSON·CSV 무관, **50~100개면 충분**.

### 아직 불필요 — 혼잡도 원본

방문자 수 통계(한국관광 데이터랩 계열)는 예측 로직을 실제로 구현할 때 필요. 지금은 `predictor/app/main.py`의 `_MOCK_CURVE`가 더미 곡선을 반환한다.
