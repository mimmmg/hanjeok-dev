import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AlternativeCard,
  type Alternative,
} from '@/components/AlternativeCard'
import { DeviceFrame } from '@/components/DeviceFrame'
import { Icon } from '@/components/Icon'
import { TRAVEL_MODE_LABEL, toTravelMode } from '@/types/travel'
import { scoreAlternative } from '@/utils/alternativeScore'
import { distanceKm } from '@/utils/distance'
import { seoulHour } from '@/utils/seoulTime'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: '대안 비교 — 한적' }

/** 보여줄 대안 개수. 너무 많으면 비교가 아니라 또 다른 목록이 된다 */
const MAX_ALTERNATIVES = 5

export default async function AlternativesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ mode?: string }>
}) {
  const { id } = await params
  const { mode: rawMode } = await searchParams
  const mode = toTravelMode(rawMode)

  const supabase = await createClient()
  const hour = seoulHour()

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
    .order('forecast_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const basePct = baseForecast?.congestion_pct ?? null

  /*
   * ── 후보 ──
   * 같은 구 안의 다른 장소를 후보로 삼는다. 구가 같으면 대체로 이동 부담이
   * 작고 여행 동선도 안 깨진다. 좌표 기반 반경 탐색이 더 정교하지만,
   * 그 판단은 FastAPI 스코어링으로 옮길 때 함께 다룬다.
   */
  const { data: candidates } = await supabase
    .from('place')
    .select(
      'id, name, category, access_desc, fee, lat, lng, congestion_forecast(congestion_pct, forecast_date)',
    )
    .eq('district', base.district ?? '')
    .neq('id', id)
    .eq('congestion_forecast.hour_slot', hour)
    .order('forecast_date', {
      referencedTable: 'congestion_forecast',
      ascending: false,
    })
    .limit(1, { referencedTable: 'congestion_forecast' })

  const alternatives = (candidates ?? [])
    .map((c): Alternative | null => {
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

      return {
        id: c.id,
        name: c.name,
        category: c.category,
        accessDesc: c.access_desc,
        fee: c.fee,
        congestionPct,
        distanceKm: km,
        score: scoreAlternative({
          congestionPct,
          distanceKm: km,
          accessDesc: c.access_desc,
          mode,
        }),
      }
    })
    .filter((a): a is Alternative => a !== null)
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, MAX_ALTERNATIVES)

  return (
    <DeviceFrame title="대안 비교" backHref={`/place/${id}`}>
      <div className="flex flex-col gap-4 px-6 pt-6 pb-10">
        <header className="zin">
          <p className="font-display text-muted text-caption font-semibold tracking-[0.08em] uppercase">
            {base.district ?? '서울'} · {TRAVEL_MODE_LABEL[mode]} 기준
          </p>
          <h2 className="font-display mt-2 text-title font-bold tracking-[-0.01em]">
            {base.name} 대신 가볼 만한 곳
          </h2>
          <p className="text-body mt-2 text-label leading-relaxed">
            {basePct !== null && (
              <>
                지금 {base.name}은(는){' '}
                <strong className="text-ink tabular">{basePct}</strong>입니다.{' '}
              </>
            )}
            혼잡도와 접근성을 함께 계산해 {alternatives.length}곳을 골랐습니다.
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
                    mode={mode}
                    baseName={base.name}
                    basePct={basePct}
                  />
                </li>
              ))}
            </ul>

            <p className="text-faint bg-sunk rounded-xs p-3 text-caption leading-relaxed">
              점수는 <strong>혼잡도 60% + 접근성 40%</strong>로 계산한 임시
              값입니다. 날씨는 아직 반영되지 않았고, 정식 스코어링은 예측
              서비스가 맡을 예정입니다.
            </p>
          </>
        )}
      </div>
    </DeviceFrame>
  )
}
