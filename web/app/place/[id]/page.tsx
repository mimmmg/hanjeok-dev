import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CongestionChart } from '@/components/CongestionChart'
import { CongestionGauge } from '@/components/CongestionGauge'
import { DeviceFrame } from '@/components/DeviceFrame'
import { DistanceFromMe } from '@/components/DistanceFromMe'
import { Icon } from '@/components/Icon'
import { PlaceDetailActions } from '@/components/PlaceDetailActions'
import type { HourSlot } from '@/types/forecast'
import {
  CONGESTION_LABEL,
  CONGESTION_STYLE,
  congestionLevel,
} from '@/utils/congestionLevel'
import { kakaoDirectionsUrl } from '@/utils/mapLink'
import { seoulHour, seoulToday } from '@/utils/seoulTime'
import { createClient } from '@/utils/supabase/server'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('place')
    .select('name')
    .eq('id', id)
    .maybeSingle()

  return { title: data ? `${data.name} — 한적` : '장소 — 한적' }
}

/**
 * 장소 상세 화면 (PRD ⑤ "장소 상세").
 *
 * 조회는 서버에서 하고, 조작(도보/차 토글·담기·대안 보기)만 클라이언트로 넘긴다.
 * 화면 전체를 클라이언트 컴포넌트로 만들면 DB 조회가 브라우저로 내려가
 * 응답이 느려지고 쿼리 구조도 노출된다.
 */
export default async function PlaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const hour = seoulHour()
  const today = seoulToday()

  const { data: place } = await supabase
    .from('place')
    .select(
      'id, name, name_en, district, category, address, access_desc, fee, lat, lng',
    )
    .eq('id', id)
    .maybeSingle()

  if (!place) notFound()

  /*
   * 하루치 24행을 가져온다. forecast_date 를 고정하지 않고 최신 기준일을
   * 먼저 찾는 이유: 오늘치가 아직 없어도 최근 예측치로 그래프를 그려야
   * 화면이 비지 않는다 (PRD ⑦ 가용성).
   */
  const { data: latest } = await supabase
    .from('congestion_forecast')
    .select('forecast_date')
    .eq('place_id', id)
    .order('forecast_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const forecastDate = latest?.forecast_date ?? null

  const { data: rows } = forecastDate
    ? await supabase
        .from('congestion_forecast')
        .select('hour_slot, congestion_pct')
        .eq('place_id', id)
        .eq('forecast_date', forecastDate)
        .order('hour_slot')
    : { data: null }

  const slots: HourSlot[] = rows ?? []
  const current = slots.find((s) => s.hour_slot === hour) ?? null
  const currentPct = current?.congestion_pct ?? null
  const level = currentPct === null ? null : congestionLevel(currentPct)

  // 오늘 남은 시간 중 가장 한적한 때 — "언제 가면 되는지"에 대한 직접적인 답
  const quietest = slots
    .filter((s) => s.hour_slot > hour && s.congestion_pct > 0)
    .reduce<HourSlot | null>(
      (best, s) => (!best || s.congestion_pct < best.congestion_pct ? s : best),
      null,
    )

  // 이미 담았는지. RLS 로 본인 행만 조회되므로 세션이 없으면 그냥 빈 결과다
  const { data: favorite } = await supabase
    .from('user_favorite')
    .select('id')
    .eq('place_id', id)
    .maybeSingle()

  const isStale = forecastDate !== null && forecastDate !== today

  // 좌표가 있으면 좌표로, 없으면 주소로 길찾기를 연다
  const mapUrl = kakaoDirectionsUrl({
    name: place.name,
    lat: place.lat,
    lng: place.lng,
    address: place.address,
  })

  return (
    <DeviceFrame title={place.name} backHref="/search">
      <div className="flex flex-col gap-4 px-6 pt-6 pb-10">
        {/* ── 현재 혼잡도 ── */}
        <section className="bg-card border-line zin rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display truncate text-title font-bold tracking-[-0.01em]">
                {place.name}
              </h2>
              <p className="text-faint mt-1 text-caption">
                {[place.category, place.district].filter(Boolean).join(' · ')}
                {/*
                  위치 권한이 있으면 거리를 덧붙인다. 없으면 아무것도 그리지
                  않아 이 줄은 그대로다 (PRD ⑦ — 권한 거부 시 거리만 생략).
                */}
                <DistanceFromMe
                  lat={place.lat}
                  lng={place.lng}
                  className="before:content-['_·_']"
                />
              </p>
            </div>
          </div>

          {currentPct === null || level === null ? (
            <p className="text-muted mt-4 text-ui leading-relaxed">
              이 장소의 혼잡 예측치가 아직 없습니다.
            </p>
          ) : (
            <>
              <div className="mt-4 flex items-end gap-3">
                <span
                  className={`font-display tabular text-hero leading-none font-extrabold tracking-[-0.03em] ${CONGESTION_STYLE[level].fg}`}
                >
                  {currentPct}
                </span>
                <span
                  className={`font-display mb-0.5 text-lead font-bold ${CONGESTION_STYLE[level].fg}`}
                >
                  {CONGESTION_LABEL[level]}
                </span>
                <span className="text-muted mb-1 ml-auto text-label">
                  {hour}시 기준
                </span>
              </div>

              <div className="mt-3">
                <CongestionGauge pct={currentPct} />
              </div>
            </>
          )}
        </section>

        {/* ── 시간대별 그래프 ── */}
        {slots.length > 0 && (
          <section className="bg-card border-line zin rounded-lg border p-4 [animation-delay:0.06s]">
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <h3 className="font-display text-muted text-caption font-semibold tracking-[0.08em] uppercase">
                시간대별 예측
              </h3>
              {quietest && (
                <p className="text-calm-fg text-caption font-semibold">
                  {quietest.hour_slot}시가 가장 여유로워요
                </p>
              )}
            </div>

            <CongestionChart slots={slots} nowHour={hour} />

            <p className="text-faint mt-2 text-micro leading-relaxed">
              KTO 공공데이터 기반 <strong>예측치</strong>입니다. 실시간 집계가
              아닙니다.
              {isStale && ` 기준일 ${forecastDate}.`}
            </p>
          </section>
        )}

        {/* ── 조작부 ── */}
        <div className="zin [animation-delay:0.12s]">
          <PlaceDetailActions
            placeId={place.id}
            placeName={place.name}
            currentPct={currentPct}
            initiallySaved={Boolean(favorite)}
          />
        </div>

        {/* ── 기본 정보 ── */}
        <section className="bg-card border-line zin rounded-lg border p-4 [animation-delay:0.18s]">
          <dl className="flex flex-col gap-3">
            {(
              [
                ['주소', place.address],
                ['접근성', place.access_desc],
                ['입장료', place.fee],
              ] as const
            ).map(([label, value]) =>
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

          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="font-display bg-ink text-screen mt-4 flex min-h-tap items-center justify-center gap-2 rounded-full text-ui font-bold transition-colors hover:bg-[#132218]"
            >
              <Icon name="directions" size={19} />
              카카오맵으로 길찾기
            </a>
          )}
        </section>
      </div>
    </DeviceFrame>
  )
}
