# 문제 해결 기록

겪은 버그와 해결 과정을 남긴다. **같은 함정에 다시 빠지지 않기 위한 문서**이고,
"왜 이렇게 짰지?" 싶은 코드의 근거를 되짚는 자리이기도 하다.

기록 기준 — 아래 중 하나에 해당하면 남긴다.
- **조용히 깨지는 것**: 빌드·테스트는 통과하는데 실제로는 동작하지 않음
- **원인이 코드 밖에 있는 것**: 라이브러리 동작, 외부 API 규격, 브라우저 확장
- **다시 만나기 쉬운 것**: 같은 실수를 반복할 여지가 있음

---

## 목차

- [보안](#보안)
  - [로그에 인증키가 찍힘](#로그에-인증키가-찍힘)
  - [실제 secret key 를 `.env.example` 에 넣음](#실제-secret-key-를-envexample-에-넣음)
- [Next.js / React](#nextjs--react)
  - [`<link>` 가 `<html>` 의 자식이 되어 하이드레이션 실패](#link-가-html-의-자식이-되어-하이드레이션-실패)
  - [Next.js 가 Google Fonts `@import` 를 CSS 에서 제거](#nextjs-가-google-fonts-import-를-css-에서-제거)
  - [외부 `@import` 를 `@import "tailwindcss"` 뒤에 두면 무시됨](#외부-import-를-import-tailwindcss-뒤에-두면-무시됨)
  - [`middleware.ts` 가 `proxy.ts` 로 바뀜 (Next 16)](#middlewarets-가-proxyts-로-바뀜-next-16)
  - [effect 안의 동기 setState 가 린트에 막힘](#effect-안의-동기-setstate-가-린트에-막힘)
  - [`size-5.5` 가 CSS 를 만들지 않음](#size-55-가-css-를-만들지-않음)
  - [Node 18 로는 빌드가 안 됨](#node-18-로는-빌드가-안-됨)
  - [하이드레이션 경고가 우리 탓이 아닌 경우](#하이드레이션-경고가-우리-탓이-아닌-경우)
- [데이터베이스](#데이터베이스)
  - [PostgREST upsert 가 다른 행의 컬럼을 null 로 덮음](#postgrest-upsert-가-다른-행의-컬럼을-null-로-덮음)
  - [한 배치에 같은 UNIQUE 키가 두 번 들어감](#한-배치에-같은-unique-키가-두-번-들어감)
- [외부 API](#외부-api)
  - [TourAPI 에 경복궁이 없음](#tourapi-에-경복궁이-없음)
  - [TourAPI 의 좌표 함정](#tourapi-의-좌표-함정)
  - [기상청 단기예보 403 — 실은 다른 서비스 키였다](#기상청-단기예보-403--실은-다른-서비스-키였다)
- [배포](#배포)
  - [Vercel 프로젝트가 3개로 늘어남](#vercel-프로젝트가-3개로-늘어남)
- [설정](#설정)
  - [`WEATHER_API_KEY` 라는 이름이 사고를 만들었다](#weather_api_key-라는-이름이-사고를-만들었다)
- [로직](#로직)
  - [휴무일 파싱이 "요일" 의 '일' 을 일요일로 읽음](#휴무일-파싱이-요일-의-일-을-일요일로-읽음)
  - [요일·계절 계수를 곱하니 전부 100 에 붙음](#요일계절-계수를-곱하니-전부-100-에-붙음)

---

# 보안

## 로그에 인증키가 찍힘

**증상** — 예측 서비스 로그에 인증키가 그대로 남았다.

```
날씨 조회 실패(KmaClient): Client error '403 Forbidden' for url
'https://apis.data.go.kr/.../getVilageFcst?serviceKey=ade1c...&nx=60&ny=127'
```

**원인** — 두 갈래였다.

1. `httpx` 가 정상 요청도 INFO 로그에 URL 통째로 남긴다.
2. `HTTPStatusError` 의 메시지 자체에 요청 URL 이 들어있다. 로거 레벨을 올려도
   우리가 `logger.warning("...: %s", exc)` 로 찍으면 그대로 새어 나온다.

우리 요청은 `serviceKey` 를 쿼리스트링에 넣기 때문에 둘 다 키를 노출한다.
배포 플랫폼 로그는 여러 사람이 보고 오래 남는다.

**해결**

```python
# app/config.py — 정상 요청 로그 차단
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)

# app/redact.py — 예외 메시지의 키 값을 가림
logger.warning("날씨 조회 실패(%s): %s", type(source).__name__, redact(exc))
```

**교훈** — 외부 API 를 쿼리스트링 인증으로 부르면, **예외 메시지도 비밀값을 담는다.**
로거 레벨만 조정하면 절반만 막힌다.

---

## 실제 secret key 를 `.env.example` 에 넣음

**증상** — `.env.seed.example` 에 진짜 `sb_secret_...` 값이 들어갔다.
이 파일은 `.gitignore` 에 `!.env.example` 예외로 **커밋되는 파일**이다.

**원인** — `.env*` 는 무시되는데 `.example` 만 예외로 커밋되게 해둔 구조를
헷갈렸다. 이름이 비슷해서 "example 이니 안 올라간다"고 오해하기 쉽다.

**해결** — 값을 `.env.seed`(무시됨)로 옮기고 `.example` 은 빈칸으로 되돌렸다.
커밋 전이라 히스토리에는 들어가지 않았다(`git log -S` 로 확인).

**교훈**
- `.example` 파일은 **커밋된다.** 값을 넣는 곳이 아니라 변수 이름을 알리는 곳이다.
- 노출된 자격증명은 히스토리에 없어도 폐기하는 게 원칙이다.

---

# Next.js / React

## `<link>` 가 `<html>` 의 자식이 되어 하이드레이션 실패

**증상**

```
Cannot render a <link rel="stylesheet" /> outside the main document
without knowing its precedence.
In HTML, <link> cannot be a child of <html>. This will cause a hydration error.
```

**원인** — 아이콘 서체를 싣기 위해 `layout.tsx` 의 `<html>` 안에
`<link>` 를 직접 뒀다. HTML 명세상 `<link>` 는 `<html>` 의 자식이 될 수 없다.
App Router 에서는 `<head>` 를 직접 쓸 수 없어서 이 자리에 두게 되는데,
React 는 `precedence` 가 없으면 어디로 올려야 할지 몰라 그대로 둔다.

**해결**

```tsx
// precedence 를 주면 React 가 head 로 올리고 순서까지 관리한다
<link rel="stylesheet" href={ICON_FONT_URL} precedence="default" />

// preconnect 는 link 대신 API 를 쓴다
ReactDOM.preconnect("https://fonts.gstatic.com", { crossOrigin: "anonymous" })
```

**검증** — 렌더된 HTML 에서 `<head>` 안 링크 1개, `<head>` 밖 0개를 확인했다.

**곁가지** — 수정 직후 HMR 에서
`Expected <link> not to update to be updated to a stylesheet with precedence`
가 한 번 났다. 같은 `href` 가 precedence 없이 렌더된 적이 있어서 생기는
핫리로드 잔여물이고, dev 서버를 새로 띄우면 사라진다.

---

## Next.js 가 Google Fonts `@import` 를 CSS 에서 제거

**증상** — `globals.css` 에 Material Symbols 를 `@import url("https://fonts.googleapis.com/...")`
로 넣었는데 아이콘이 글자로 보였다 (`check_circle` 이 그대로 노출).

**원인** — Next.js 가 `fonts.googleapis.com` 의 `@import` 를 CSS 에서 **제거한다**
(`next/font` 를 쓰라는 의도). 같은 파일의 jsdelivr(Pretendard) `@import` 는 남아 있었다.

**해결** — `layout.tsx` 의 `<link>` 로 옮겼다. `next/font/google` 은 쓰지 않았다 —
아이콘 가변폰트 전체가 2.28MB 라 서브셋이 필요한데 `next/font` 는 `icon_names`
서브셋을 지원하지 않는다.

**검증**

```
컴파일된 CSS 에서 "Material+Symbols" 검색 → 0건 (제거 확인)
서브셋 폰트 5.2KB vs 전체 2,283.7KB (440배 차이)
```

---

## 외부 `@import` 를 `@import "tailwindcss"` 뒤에 두면 무시됨

**증상** — 빌드 경고만 나고 통과하는데, 브라우저에서 Pretendard 가 실리지 않았다.

```
@import rules must precede all rules aside from @charset and @layer statements
```

**원인** — `@import "tailwindcss"` 가 CSS 규칙으로 펼쳐지므로, 그 뒤의
`@import url(...)` 은 "모든 규칙보다 앞서야 한다"는 CSS 명세에 걸려
브라우저가 **통째로 무시한다.**

**해결** — 외부 서체 `@import` 를 `@import "tailwindcss"` **앞으로** 옮겼다.

**교훈** — 빌드 경고가 곧 무해한 건 아니다. 이건 "서체가 조용히 안 실리는" 버그였다.

---

## `middleware.ts` 가 `proxy.ts` 로 바뀜 (Next 16)

**증상** — Supabase 공식 문서대로 `middleware.ts` 를 만들었는데 세션 갱신이 동작하지 않았다.

**원인** — Next.js 16 에서 `middleware.js|ts` 규약이 **`proxy.js|ts` 로 이름이 바뀌고**
export 도 `middleware` → `proxy` 가 됐다. Supabase 문서는 아직 옛 이름 기준이다.
`cookies()` 도 async 로 바뀌어 `await` 가 필요하다.

**해결** — `web/proxy.ts` 로 옮기고 `export async function proxy(request)` 로 바꿨다.

**교훈** — `web/AGENTS.md` 가 *"This is NOT the Next.js you know"* 라고 경고하는 게
실제로 유효했다. 새 메이저 버전에서는 `node_modules/next/dist/docs/` 를 먼저 본다.

---

## effect 안의 동기 setState 가 린트에 막힘

**증상**

```
Error: Calling setState synchronously within an effect can trigger cascading renders
react-hooks/set-state-in-effect
```

**원인** — `useGeolocation` 훅에서 `useEffect` 본문에서 바로
`setState({ status: 'loading' })` 을 불렀다. React Compiler 린트가 막는다.

**해결**

```ts
// 초기값은 useState 초기화 함수로
const [state, setState] = useState(() => enabled ? {status:'loading'} : {status:'idle'})

// effect 본문에서 어쩔 수 없이 바꿔야 하면 한 틱 미룬다
queueMicrotask(() => setState({ status: 'unavailable' }))
```

이후 상태 변경은 `getCurrentPosition` 콜백에서만 일어난다.

---

## `size-5.5` 가 CSS 를 만들지 않음

**증상** — 빌드·린트 모두 통과하는데 요소 크기가 안 먹었다.

**원인** — Tailwind v4 에서 `size-5.5` 같은 분수 spacing 이 유틸리티로 생성되지 않았다.
에러도 경고도 없다.

**해결** — `size-[22px]` 로 바꿨다.

**교훈** — Tailwind 는 인식하지 못한 클래스를 **조용히 버린다.**
새 유틸리티를 쓸 때는 컴파일된 CSS 에 실제로 규칙이 생겼는지 확인한다.

```bash
curl -s "$CSS_URL" | tr '}' '}\n' | grep '\.size-'
```

---

## Node 18 로는 빌드가 안 됨

**증상**

```
You are using Node.js 18.20.8. For Next.js, Node.js version ">=20.9.0" is required.
```

**원인** — Next.js 16 이 Node 20.9+ 를 요구한다. 시스템 기본이 18 이었다.

**해결** — `.nvmrc` 에 `22` 를 두고 `nvm use` 로 붙인다.
`nvm alias default 22` 는 **새로 여는 셸부터** 적용된다 (지금 창에는 `nvm use 22`).

**곁가지** — Vercel CLI 가 Node 18 경로에 설치돼 있어서, PATH 를 22 로 바꾸면
`command not found: vercel` 이 난다. 전체 경로로 부르면 된다.

---

## 하이드레이션 경고가 우리 탓이 아닌 경우

**증상** — 화면 왼쪽 아래 빨간 표시. 콘솔에 hydration mismatch.

**원인** — 브라우저 확장(Bitdefender 안티트래커)이 React 가 인계받기 직전에
DOM 에 속성을 심는다.

```
- bis_skin_checked="1"
- bis_register="W3sibWFzdGVyIjp0cnVlLCJleHRlbnNpb25JZCI6ImVwcGlvY2VtaG1ubGJoanBsY2drb2ZjaWll..."
- __processed_<uuid>__="true"
```

**해결** — 코드로 고칠 것이 없다. **시크릿 창에서 열면 사라진다.**
`suppressHydrationWarning` 은 해당 요소의 속성만 덮으므로, 확장이 하위 `<div>` 까지
건드리는 이 경우엔 소용이 없다.

**교훈** — hydration 경고를 보면 **먼저 시크릿 창으로 재현해본다.**
에러 메시지 마지막 항목이 이미 "브라우저 확장" 을 언급한다.

---

# 데이터베이스

## PostgREST upsert 가 다른 행의 컬럼을 null 로 덮음

**증상** — 상세정보를 277곳에 채웠는데, 장소 동기화를 한 번 돌리자 **65곳으로 줄었다.**

**원인** — 한 배치에 키 집합이 다른 행을 섞었다.

```python
rows = [
  {"kto_content_id": "...", "name": "..."},                      # 대부분
  {"kto_content_id": "...", "name": "...", "use_time": "..."},   # 랜드마크만
]
```

PostgREST 는 배치 upsert 에서 **키 집합을 통일**한다. `use_time` 이 없는 행에는
null 이 채워지고, `ON CONFLICT DO UPDATE` 가 기존 값을 null 로 덮는다.

**해결** — 기본 컬럼과 상세 컬럼을 **두 번의 upsert 로 분리**했다.

**교훈** — 배치 upsert 에서는 모든 행이 같은 키를 가져야 한다.
일부 행에만 있는 컬럼은 별도 요청으로 보낸다.

---

## 한 배치에 같은 UNIQUE 키가 두 번 들어감

**증상**

```
ON CONFLICT DO UPDATE command cannot affect row a second time (21000)
```

**원인** — 집중률 API 의 서로 다른 두 이름이 이름 정규화 후 같은 TourAPI 장소로
매칭됐다 (`창덕궁과 후원 [유네스코 세계유산]`, `창덕궁 낙선재` → 같은 contentid).
같은 `kto_content_id` 가 한 배치에 두 번 들어갔다.

**해결** — 이미 쓴 id 를 추적하고, 중복이면 집중률 이름 기반 키(`cnctr-{name}`)로
대체했다.

---

# 외부 API

## TourAPI 에 경복궁이 없음

**증상** — `경복궁` 검색 결과 0건. 서울 혼잡도 서비스에서 경복궁이 안 나온다.

**원인** — `place` 를 **집중률 API ∩ TourAPI 교집합**으로 채우고 있었다.
그런데 TourAPI KorService2 의 지역기반 목록에 경복궁·창덕궁·종묘·광화문·덕수궁이
**아예 없다** (창경궁·경희궁은 있다). 검색해도 "한복남 경복궁점"(한복 대여점)과
"경복궁 별빛야행"(행사)만 나온다.

```
집중률 종로구 113곳 ∩ TourAPI 132곳 = 55곳
못 찾은 58곳: 경복궁, 광화문, 광화문광장, 종묘, 창덕궁과 후원 …
```

**해결** — 기준을 **집중률 API 주도**로 바꿨다 (258곳 → 673곳).
TourAPI 는 좌표·주소를 붙이는 보강재로만 쓴다. 좌표가 없는 장소도 저장한다 —
거리·대안 후보에서 빠질 뿐 검색·혼잡도·담기는 동작한다.

TourAPI 에 아예 없는 주요 관광지는 `predictor/app/landmarks.py` 에 좌표와
기본정보를 직접 적는다.

**교훈** — 두 데이터 소스의 교집합은 **가장 유명한 항목을 떨어뜨릴 수 있다.**
"둘 다 있어야 안전하다"는 직관이 틀린 경우다.

---

## TourAPI 의 좌표 함정

정제 단계에서 걸러낸 것들. 모두 그대로 두면 조용히 잘못된 데이터가 된다.

| 함정 | 결과 | 처리 |
|---|---|---|
| `mapx` = 경도, `mapy` = 위도 | 뒤집으면 서울이 아니라 남극 | 이름 그대로 매핑하지 말고 의미로 매핑 |
| 좌표를 모를 때 `0` 을 준다 | 아프리카 앞바다로 찍힘 | `0` 을 결측으로 취급 |
| `items` 가 빈 문자열로 온다 | 인덱싱하면 터짐 | `if not items: return []` |
| 페이지 경계에서 같은 장소 중복 | 중복 행 | `drop_duplicates` |

---

## 기상청 단기예보 403 — 실은 다른 서비스 키였다

**증상**

```
Client error '403 Forbidden' for url
'https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=*****'
```

**원인** — 키 자체가 **data.go.kr 것이 아니었다.** OpenWeatherMap 키(32자 hex)를
`WEATHER_API_KEY` 에 넣었고, 코드가 그 변수를 기상청 키로 취급해 기상청 엔드포인트로
호출했다. 서비스가 다르니 게이트웨이가 403 으로 거부한 것이다.

`403` 을 보고 처음엔 "활용신청이 안 된 키"로 의심했는데, 실제 원인은
**변수 이름이 제공자를 구분하지 못한 것**이었다.

**해결** — 변수를 제공자별로 나눴다.

```
KMA_API_KEY=            # 기상청 (data.go.kr)
OPENWEATHER_API_KEY=    # OpenWeatherMap
```

값을 `OPENWEATHER_API_KEY` 로 옮기자 대체 없이 바로 성공했다.

**교훈** — data.go.kr 의 403 은 "활용신청 안 됨"이 흔한 원인이지만,
**애초에 그 서비스의 키가 아닌 경우**도 있다. 키 길이·형식이 단서가 된다
(OpenWeatherMap 32자 hex, data.go.kr 는 더 길거나 base64).

**후속 검증 (2026-08-20)** — 403 이 코드 탓일 가능성을 지우기 위해 공식 활용가이드
(`기상청41_단기예보 조회서비스_오픈API활용가이드`)와 `KmaClient` 를 전부 대조했다.

| 항목 | 가이드 | 우리 코드 | |
|---|---|---|---|
| 엔드포인트 | `VilageFcstInfoService_2.0/getVilageFcst` | 동일 | ✅ |
| 발표시각 | 02·05·08·11·14·17·20·23 | `KMA_BASE_TIMES` 동일 | ✅ |
| 파라미터 | `serviceKey / dataType / numOfRows / pageNo / base_date / base_time / nx / ny` | 동일 | ✅ |
| 카테고리 | `TMP`(기온) `POP`(강수확률) | 동일 | ✅ |
| 격자 변환 | 별첨 엑셀 대조표 | 서울 12지점 **12/12 일치** (60,127) | ✅ |

가이드 본문은 `http://` 로 적혀 있으나 실제 엔드포인트는 `https://` 가 맞다
(사용자 확인). 스킴은 403 과 무관했다.

**결론** — 코드는 규격대로다. 기상청으로 갈아타려면 **data.go.kr 에서
`기상청_단기예보 조회서비스` 활용신청 후 받은 키를 `KMA_API_KEY` 에 넣는 것**만
남았다. 넣으면 `weather_provider` 가 자동으로 `kma` 로 바뀐다 (`config.py`).

**참고 — 물러나기 설계가 값을 했다.** 403 이 나는 동안에도 예측은 멈추지 않았다.

```
지정 제공자 → Open-Meteo(키 불필요) → mock
```

무엇으로 대체했는지 배치 결과 `notes` 에 실어 보낸다 —
**조용히 mock 을 쓰는 게 가장 나쁘다.**

---

# 설정

## `WEATHER_API_KEY` 라는 이름이 사고를 만들었다

**증상** — OpenWeatherMap 키가 기상청 API 로 전송돼 403.

**원인** — 처음에 날씨 제공자를 하나만 생각해 변수를 `WEATHER_API_KEY` 로 뒀다.
나중에 제공자가 셋으로 늘었는데 이 이름은 **어느 서비스의 키인지 담지 못한다.**
코드는 "채워져 있으면 기상청"이라고 가정했고, 사용자는 OpenWeatherMap 키를 넣었다.

**해결** — 제공자별 이름으로 나누고, 애매한 옛 이름은 아예 없앴다.
`.env.example` 에 "이 이름은 쓰지 않는다"고 경고까지 남겼다.

**교훈** — 환경변수 이름은 **값의 출처를 담아야 한다.**
`WEATHER_API_KEY` 처럼 역할만 적으면, 제공자가 둘 이상 될 때 반드시 헷갈린다.

---

# 배포

## Vercel 프로젝트가 3개로 늘어남

**증상** — 푸시 한 번에 3개가 동시에 배포되고, 어떤 주소는 404 가 났다.
환경변수를 넣어도 다음에 보면 또 비어 있는 것처럼 보였다 (실은 다른 프로젝트를 본 것).

```
hanjeok-dev        404  Framework: Other
hanjeok-dev-kuv2   200  Framework: Next.js  ← 정상
hanjeok-dev-9saw   302  Framework: Other
```

**원인** — 같은 저장소를 여러 번 Import 하면 프로젝트가 그만큼 생긴다.
Vercel 은 저장소를 만들지 않는다 — `git push` 는 **배포**를 만들고,
Import 가 **프로젝트**를 만든다.

진짜 차이는 Root Directory 가 아니라 **Framework Preset** 이었다.
셋 다 Root Directory 는 `web` 으로 맞았는데, 두 개가 `Other` 로 굳어 있었다.
Vercel 이 Import 시점에 프레임워크를 감지하므로, **Root Directory 를 나중에
`web` 으로 바꾼 프로젝트는 감지 시점에 루트를 보고 있었기 때문에** Next.js 로
잡히지 않았다.

**해결** — 정상 프로젝트 하나만 남기고 나머지 삭제.

**교훈** — 새로 Import 할 때는 **Root Directory 를 먼저 지정**한다.
나중에 바꾸면 Framework Preset 은 따라오지 않는다.

---

# 로직

## 휴무일 파싱이 "요일" 의 '일' 을 일요일로 읽음

**증상** — `"매주 월요일"` 이 월요일과 **일요일** 둘로 파싱됐다.
`"매주 토요일~일요일"` 은 `일~일` 로 잡혀 **토요일이 빠졌다.**

**원인** — 요일 글자를 하나씩 훑었는데, `"요일"` 이라는 말 자체에 `일` 이 있다.

**해결 (2단계)**

```python
# 1) "요일" 을 먼저 지운다 → "월", "토~일"
cleaned = match.group(1).replace("요일", "")

# 2) 요일 글자와 구분자만 이어지는 앞부분까지만 읽는다
#    "매주 월요일(공휴일인 경우 다음날)" 의 '공휴일' 에서 또 일요일이 잡혔다
_WEEKDAY_RUN = re.compile(r"[월화수목금토일~\-,·및\s]+")
```

**검증** — 12가지 표현을 표로 만들어 기대값과 대조했다. 두 번의 수정 모두
이 표가 잡아냈다.

**교훈** — 한국어 자유 문장 파싱은 **부분 문자열이 서로를 삼킨다.**
기대값 표를 먼저 만들고 고치는 편이 빠르다.

---

## 요일·계절 계수를 곱하니 전부 100 에 붙음

**증상** — 10월 토요일 예측에서 여러 장소가 한꺼번에 100 이 됐다.
대안 비교가 "어디가 더 한적한가"를 가리는 화면인데 구분이 사라졌다.

**원인** — 요일 계수(최대 1.4)와 월 계수(최대 1.4)를 곱하면 **1.96** 까지 간다.
`peak_level` 이 100 에서 잘리므로 상위권이 전부 포화됐다.

**해결** — 두 겹으로 상한을 뒀다. 개별 계수는 `[0.6, 1.4]`, 곱한 값은 `[0.5, 1.5]`.

```
2월 월요일 (비수기·휴관)  계수 0.50 → 정점 45
8월 수요일                계수 0.79 → 정점 72
10월 토요일 (단풍철 주말)  계수 1.50 → 정점 100
```

**교훈** — 배율을 곱해 쓰는 값은 **곱한 뒤에도 한 번 더 묶는다.**
개별 상한만으로는 조합에서 터진다.

> 참고: 이후 KTO 집중률 API 를 붙이면서 이 계수 자체를 걷어냈다.
> 집중률에 요일·계절이 이미 반영돼 있어 다시 곱하면 이중 반영이 된다.
