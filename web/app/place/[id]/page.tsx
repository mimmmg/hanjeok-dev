import { notFound } from 'next/navigation'
import { CongestionGauge } from '@/components/CongestionGauge'
import { CongestionTag } from '@/components/CongestionTag'
import { DeviceFrame } from '@/components/DeviceFrame'
import { seoulHour } from '@/utils/seoulTime'
import { createClient } from '@/utils/supabase/server'

/**
 * [임시] 장소 상세 화면의 자리만 잡아둔 것.
 *
 * 검색 결과에서 항목을 누르면 여기로 오는데, 화면이 없으면 404 가 나므로
 * 최소한만 만들었다. 정식 상세 화면(PRD ⑤ "장소 상세")은 시간대별 그래프,
 * 도보/차 토글, 혼잡 시 "대안 보기" 조건부 노출을 갖춰야 해서 별도 작업이다.
 */
export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const hour = seoulHour()

  const { data: place } = await supabase
    .from('place')
    .select('id, name, district, category, address, access_desc, fee')
    .eq('id', id)
    .maybeSingle()

  if (!place) notFound()

  const { data: forecast } = await supabase
    .from('congestion_forecast')
    .select('congestion_pct')
    .eq('place_id', id)
    .eq('hour_slot', hour)
    .order('forecast_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const pct = forecast?.congestion_pct ?? null

  return (
    <DeviceFrame title={place.name} backHref="/search">
      <div className="flex flex-col gap-4 px-6 pt-6 pb-10">
        <section className="bg-card border-line zin rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-title font-bold tracking-[-0.01em]">
                {place.name}
              </h2>
              <p className="text-faint mt-1 text-caption">
                {[place.category, place.district].filter(Boolean).join(' · ')}
              </p>
            </div>
            {pct !== null && <CongestionTag pct={pct} />}
          </div>

          {pct !== null && (
            <div className="mt-4">
              <CongestionGauge pct={pct} />
              <p className="text-faint mt-3 text-caption">
                {hour}시 기준 예측치입니다.
              </p>
            </div>
          )}
        </section>

        <section className="bg-card border-line zin rounded-lg border p-4 [animation-delay:0.06s]">
          <dl className="flex flex-col gap-3">
            {[
              ['주소', place.address],
              ['접근성', place.access_desc],
              ['입장료', place.fee],
            ].map(([label, value]) =>
              value ? (
                <div key={label}>
                  <dt className="font-display text-muted text-caption font-semibold tracking-[0.08em] uppercase">
                    {label}
                  </dt>
                  <dd className="text-body mt-1 text-ui">{value}</dd>
                </div>
              ) : null,
            )}
          </dl>
        </section>

        <p className="text-faint bg-sunk rounded-xs p-3 text-caption leading-relaxed">
          시간대별 그래프, 도보/차 토글, 대안 보기는 아직 만들지 않았습니다.
        </p>
      </div>
    </DeviceFrame>
  )
}
