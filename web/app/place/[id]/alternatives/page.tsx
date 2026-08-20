import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AlternativeCard,
  type Alternative,
} from '@/components/AlternativeCard'
import { AlternativeSortToggle } from '@/components/AlternativeSortToggle'
import { DeviceFrame } from '@/components/DeviceFrame'
import { Icon } from '@/components/Icon'
import { TravelModeToggle } from '@/components/TravelModeToggle'
import { toAlternativeSort } from '@/types/alternativeSort'
import { toTravelMode } from '@/types/travel'
import { parseWalkMinutes, scoreAlternative } from '@/utils/alternativeScore'
import { CONGESTION_THRESHOLDS } from '@/utils/congestionLevel'
import { distanceKm } from '@/utils/distance'
import { seoulHour, seoulToday } from '@/utils/seoulTime'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: '대안 비교 — 한적' }

/** 보여줄 대안 개수. 너무 많으면 비교가 아니라 또 다른 목록이 된다 */
const MAX_ALTERNATIVES = 5

export default async function AlternativesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mode?: string; sort?: string }>
}) {
  const { id } = await params
  const { mode: rawMode, sort: rawSort } = await searchParams
  const mode = toTravelMode(rawMode)
  const sort = toAlternativeSort(rawSort)

  const supabase = await createClient()
  const hour = seoulHour()
  // 배치가 7일치를 미리 쓰므로 조회에 오늘 상한을 걸어야 한다.
  // 없으면 기준 장소와 후보 모두 미래 날짜 값으로 비교돼 순위가 뒤바뀐다.
  const today = seoulToday()

  // ── 기준 장소 ──
  const { data: base } = await supabase
    .from('place')
    .select('id, name, district, lat, lng')
    .eq('id', id)
    .maybeSingle()

  if (!base) notFound()

  const { data: baseForecast } = await supabase
    .from('congestion_forecast')
    .select('congestion_pct')
    .eq('place_id', id)
    .eq('hour_slot', hour)
    .lte('forecast_date', today)
    .order('forecast_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const basePct = baseForecast?.congestion_pct ?? null

  // 혼잡할 때와 여유로울 때 화면의 성격이 다르다.
  // 전자는 "여기 말고 저기", 후자는 "겸사겸사 근처도".
  const isCrowded =
    basePct !== null && basePct >= CONGESTION_THRESHOLDS.busy

  /*
   * ── 후보 ──
   * 같은 구 안의 다른 장소를 후보로 삼는다. 구가 같으면 대체로 이동 부담이
   * 작고 여행 동선도 안 깨진다. 좌표 기반 반경 탐색이 더 정교하지만,
   * 그 판단은 FastAPI 스코어링으로 옮길 때 함께 다룬다.
   */
  const { data: candidates } = await supabase
    .from('place')
    .select(
      'id, name, category, access_desc, lat, lng, congestion_forecast(congestion_pct, forecast_date)',
    )
    .eq('district', base.district ?? '')
    .neq('id', id)
    .eq('congestion_forecast.hour_slot', hour)
    .lte('congestion_forecast.forecast_date', today)
    .order('forecast_date', {
      referencedTable: 'congestion_forecast',
      ascending: false,
    })
    .limit(1, { referencedTable: 'congestion_forecast' })

  /*
   * 이미 담은 장소. RLS 가 auth.uid() = user_id 로 제한하므로
   * 익명 세션이 없으면 빈 배열이 온다 (에러가 아니다).
   */
  const { data: favorites } = await supabase
    .from('user_favorite')
    .select('place_id')
  const savedIds = new Set((favorites ?? []).map((f) => f.place_id))

  /*
   * ── 선별과 정렬을 나눈다 ──
   *
   * 선별(어느 다섯 곳을 보여줄지)은 가중합 점수로 한다. 화면에는 안 보이는
   * 계산이다. 선별까지 사용자가 고른 정렬 기준으로 하면 토글이 망가진다 —
   * 한적한순으로 다섯 곳을 뽑으면 전부 멀어질 수 있고, 그 상태에서
   * 가까운순을 눌러도 "먼 것들 중에 가까운 순"이 된다.
   *
   * 정렬(그 다섯 곳을 어떻게 줄 세울지)은 화면에 보이는 값으로만 한다.
   * 그래야 사용자가 카드의 숫자를 보고 순서가 맞는지 확인할 수 있다.
   */
  const scored = (candidates ?? [])
    .map((c) => {
      const congestionPct = c.congestion_forecast[0]?.congestion_pct ?? null

      // 좌표가 없으면 거리를 알 수 없다. 0 으로 두면 "바로 옆"으로 오인되므로
      // 후보에서 뺀다 — 근거 없는 추천이 이 화면의 취지와 정면으로 어긋난다.
      if (
        base.lat === null ||
        base.lng === null ||
        c.lat === null ||
        c.lng === null
      ) {
        return null
      }

      const km = distanceKm(
        { lat: base.lat, lng: base.lng },
        { lat: c.lat, lng: c.lng },
      )

      const alternative: Alternative = {
        id: c.id,
        name: c.name,
        category: c.category,
        congestionPct,
        distanceKm: km,
        transitMinutes: parseWalkMinutes(c.access_desc),
        saved: savedIds.has(c.id),
      }

      return {
        alternative,
        // 선별에만 쓰는 값. 화면으로 넘어가지 않는다.
        score: scoreAlternative({
          congestionPct,
          distanceKm: km,
          accessDesc: c.access_desc,
          mode,
        }).total,
      }
    })
    .filter((a): a is NonNullable<typeof a> => a !== null)

  // ① 선별 — 점수 상위 다섯 곳
  const picked = scored
    .toSorted((a, b) => b.score - a.score)
    .slice(0, MAX_ALTERNATIVES)
    .map((s) => s.alternative)

  // ② 정렬 — 사용자가 고른 기준으로 그 다섯 곳을 다시 줄 세운다.
  //    예측치가 없는 곳(congestionPct === null)은 판단 근거가 없으니 뒤로 보낸다.
  const alternatives = picked.toSorted((a, b) =>
    sort === 'calm'
      ? (a.congestionPct ?? Infinity) - (b.congestionPct ?? Infinity)
      : a.distanceKm - b.distanceKm,
  )

  return (
    <DeviceFrame title="대안 비교" backHref={`/place/${id}`}>
      <div className="flex flex-col gap-4 px-6 pt-6 pb-10">
        <header className="zin">
          {/*
            도보/차는 제목 옆에 둔다. 이 토글은 후보 '범위'(3km/15km)를 바꿔
            목록 구성 자체를 갈아치우므로, 바로 아랫줄의 "도보 3km 안에서 N곳"
            문구가 함께 반응하는 자리에 있어야 무엇이 바뀌는지 보인다.
            순서를 바꾸는 정렬 토글은 리스트 바로 위에 따로 둔다.
          */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-display text-muted text-caption font-semibold tracking-[0.08em] uppercase">
                {base.district ?? '서울'}
              </p>
              <h2 className="font-display mt-1.5 text-title font-bold tracking-[-0.01em]">
                {base.name} 근처 가볼 만한 곳
              </h2>
            </div>

            {alternatives.length > 0 && (
              <TravelModeToggle
                current={mode}
                sort={sort}
                basePath={`/place/${id}/alternatives`}
              />
            )}
          </div>

          <p className="text-muted mt-2 text-label leading-relaxed">
            {basePct !== null && (
              <>
                <strong className="text-ink tabular">{basePct}</strong>
                {isCrowded ? ' 혼잡' : ' 여유'} ·{' '}
              </>
            )}
            {mode === 'walk' ? '도보 3km' : '차 15km'} 안에서 {alternatives.length}곳
          </p>
        </header>

        {alternatives.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="bg-card text-terra flex size-16 items-center justify-center rounded-full shadow-[0_2px_14px_rgb(27_48_34_/_0.06)]">
              <Icon name="travel_explore" size={30} />
            </span>
            <p className="font-display text-lead font-semibold">
              같은 구에 비교할 곳이 없어요
            </p>
            <p className="text-muted text-label leading-relaxed">
              {base.district ?? '이 지역'}에 등록된 다른 장소가 아직 없습니다.
              <br />
              장소가 늘어나면 대안도 함께 늘어납니다.
            </p>
            <Link
              href={`/place/${id}`}
              className="font-display border-line-3 text-ink hover:border-muted mt-2 flex min-h-tap items-center rounded-full border px-4 text-ui font-semibold transition-colors"
            >
              상세로 돌아가기
            </Link>
          </div>
        ) : (
          <>
            {/* 리스트를 지배하는 조작이라 리스트에 붙인다 */}
            <div className="zin">
              <AlternativeSortToggle
                current={sort}
                mode={mode}
                basePath={`/place/${id}/alternatives`}
              />
            </div>

            <ul className="flex flex-col gap-3">
              {alternatives.map((alt, i) => (
                <li
                  key={alt.id}
                  className="zin"
                  style={{ animationDelay: `${Math.min(i, 4) * 0.06}s` }}
                >
                  <AlternativeCard
                    alternative={alt}
                    rank={i + 1}
                    sort={sort}
                    baseName={base.name}
                    basePct={basePct}
                  />
                </li>
              ))}
            </ul>

            {/*
              CLAUDE.md §2 — 화면에 "예측치임"을 밝힌다. 실시간처럼 보이게
              하지 않는다. 점수를 감췄으므로 여기서도 숫자를 들이대지 않고,
              어떻게 골랐는지만 한 줄로 밝힌다.
            */}
            <p className="text-faint bg-sunk rounded-xs p-3 text-caption leading-relaxed">
              이 다섯 곳은 <strong>혼잡도와 접근성을 함께 본 임시 계산</strong>
              으로 고른 뒤, 위에서 고른 기준으로 줄 세운 것입니다. 혼잡도는
              예측치이며, 정식 스코어링은 예측 서비스가 맡을 예정입니다.
            </p>
          </>
        )}
      </div>
    </DeviceFrame>
  )
}
