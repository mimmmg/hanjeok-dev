/**
 * 화면 작업용 mock 데이터 시드 스크립트.
 *
 * 실행:
 *   cd web && npm run seed
 *
 * 필요한 환경변수는 web/.env.seed 에 넣는다 (.env.seed.example 참고).
 * .env.local 이 아니라 별도 파일을 쓰는 이유:
 *   service_role 키는 RLS 를 통째로 우회하는 마스터 키다. Next.js 앱이 읽는
 *   환경변수 파일에 섞어두면 실수로 앱 코드에서 쓰거나 Vercel 에 올라갈 수 있다.
 *   시드는 사람이 손으로 돌리는 도구이므로 실행할 때만 따로 읽는다.
 *
 * 재실행해도 안전하다(idempotent):
 *   - place 는 kto_content_id UNIQUE 로 upsert
 *   - congestion_forecast 는 (place_id, forecast_date, hour_slot) UNIQUE 로 upsert
 *   두 제약 모두 이런 상황을 위해 스키마에 미리 걸어둔 것이다.
 *
 * ⚠️ 여기서 넣는 데이터는 전부 임시다. 실제 KTO TourAPI 연동 시 교체된다.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database.ts'
import { MOCK_PLACES, PROFILE_CURVES, type MockPlace } from './places.ts'

/**
 * --dry-run: DB 에 쓰지 않고 만들어질 데이터만 출력한다.
 * 키 없이 곡선이 그럴듯한지 먼저 확인할 때 쓴다.
 */
const DRY_RUN = process.argv.includes('--dry-run')

// ── 환경변수 확인 ────────────────────────────────────────────────
const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!DRY_RUN && (!SUPABASE_URL || !SERVICE_ROLE_KEY)) {
  console.error(
    [
      '환경변수가 없습니다.',
      '',
      'web/.env.seed 를 만들고 아래 두 값을 넣으세요:',
      '  SUPABASE_URL=https://nqnxvhvozzstzloymovr.supabase.co',
      '  SUPABASE_SERVICE_ROLE_KEY=<대시보드 Settings → API → service_role>',
      '',
      'web/.env.seed.example 을 복사해서 쓰면 됩니다.',
    ].join('\n'),
  )
  process.exit(1)
}

// service_role 키는 RLS 를 우회한다. 시드는 place·congestion_forecast 에
// 써야 하는데 두 테이블 모두 클라이언트 쓰기가 막혀 있어 이 키가 필요하다.
const supabase = DRY_RUN
  ? null
  : createClient<Database>(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
      auth: { persistSession: false },
    })

// ── 혼잡도 생성 ──────────────────────────────────────────────────

/**
 * 문자열을 32비트 정수로 바꾸는 해시 (FNV-1a 변형).
 * 아래 의사난수의 씨앗으로 쓴다.
 */
function hash(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 씨앗 하나로 0~1 난수를 만드는 mulberry32. */
function seededRandom(seed: number): number {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), 1 | t)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

/**
 * 한 장소의 24시간 혼잡도를 만든다.
 *
 * Math.random() 을 쓰지 않고 장소·시간으로 씨앗을 만든 의사난수를 쓴다.
 * 이렇게 하면 스크립트를 다시 돌려도 같은 값이 나와서,
 * "화면이 이상한 게 데이터가 바뀌어서인지 코드 때문인지" 헷갈릴 일이 없다.
 * 장소마다·시간마다 씨앗이 다르므로 값 자체는 충분히 흩어진다.
 */
function buildCurve(place: MockPlace): number[] {
  const base = PROFILE_CURVES[place.profile]

  return base.map((value, hour) => {
    // ±9 범위의 흔들림. 기준 곡선이 밋밋해 보이지 않게 한다
    const jitter = (seededRandom(hash(`${place.kto_content_id}:${hour}`)) - 0.5) * 18
    const scaled = value * place.popularity + jitter

    // 문 닫은 시간대(기준값 0)는 흔들림으로 살아나지 않게 그대로 0으로 둔다
    if (value === 0) return 0

    return Math.max(0, Math.min(100, Math.round(scaled)))
  })
}

/** YYYY-MM-DD (로컬 기준). forecast_date 는 date 타입이라 시각이 필요 없다 */
function today(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// ── 실행 ─────────────────────────────────────────────────────────

/** 장소별 곡선을 사람이 눈으로 확인할 수 있게 출력한다. */
function printSummary() {
  console.log('장소별 정점 시각 (프로필 · 인기도 반영):')
  for (const place of MOCK_PLACES) {
    const curve = buildCurve(place)
    const peak = curve.indexOf(Math.max(...curve))
    // 24시간을 한 줄 막대로. 굵을수록 붐빈다
    const spark = curve
      .map((v) => ' ▁▂▃▄▅▆▇█'[Math.min(8, Math.round(v / 12.5))])
      .join('')
    console.log(
      `  ${place.name.padEnd(9, '　')} ${place.profile.padEnd(6)} ` +
        `정점 ${String(peak).padStart(2)}시(${String(curve[peak]).padStart(3)})  ${spark}`,
    )
  }
}

async function main() {
  const forecastDate = today()
  console.log(`시드 시작 — ${MOCK_PLACES.length}곳 / 기준일 ${forecastDate}\n`)

  if (!supabase) {
    printSummary()
    console.log('\n--dry-run 이라 DB 에는 쓰지 않았습니다.')
    return
  }

  // ① place upsert.
  //    profile·popularity 는 곡선 계산용 정보라 테이블에 넣지 않는다.
  //    어떤 컬럼이 저장되는지 분명히 보이도록 하나씩 적는다.
  const placeRows = MOCK_PLACES.map((p) => ({
    kto_content_id: p.kto_content_id,
    name: p.name,
    name_en: p.name_en,
    category: p.category,
    district: p.district,
    address: p.address,
    lat: p.lat,
    lng: p.lng,
    access_desc: p.access_desc,
    fee: p.fee,
  }))

  const { data: places, error: placeError } = await supabase
    .from('place')
    .upsert(placeRows, { onConflict: 'kto_content_id' })
    .select('id, kto_content_id, name')

  if (placeError) {
    console.error('place 저장 실패:', placeError.message)
    process.exit(1)
  }

  console.log(`✓ place ${places.length}건 upsert 완료`)

  // ② kto_content_id → uuid 로 이어붙인다.
  //    place 의 uuid 는 DB 가 만들기 때문에 스크립트가 미리 알 수 없다.
  const idByContentId = new Map(places.map((p) => [p.kto_content_id, p.id]))

  const forecastRows = MOCK_PLACES.flatMap((place) => {
    const placeId = idByContentId.get(place.kto_content_id)
    if (!placeId) {
      console.warn(`  ! ${place.name}: id 를 찾지 못해 예측치를 건너뜁니다`)
      return []
    }

    return buildCurve(place).map((pct, hour) => ({
      place_id: placeId,
      hour_slot: hour,
      congestion_pct: pct,
      forecast_date: forecastDate,
    }))
  })

  // ③ congestion_forecast upsert
  const { error: forecastError } = await supabase
    .from('congestion_forecast')
    .upsert(forecastRows, {
      onConflict: 'place_id,forecast_date,hour_slot',
    })

  if (forecastError) {
    console.error('congestion_forecast 저장 실패:', forecastError.message)
    process.exit(1)
  }

  console.log(
    `✓ congestion_forecast ${forecastRows.length}건 upsert 완료 (${MOCK_PLACES.length}곳 × 24시간)\n`,
  )

  // ④ 사람이 눈으로 확인할 요약 — 정점 시각이 장소 성격과 맞는지 본다
  printSummary()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
