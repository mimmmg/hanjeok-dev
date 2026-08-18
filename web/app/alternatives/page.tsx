import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DeviceFrame } from '@/components/DeviceFrame'
import { Icon } from '@/components/Icon'
import { TRAVEL_MODE_LABEL, toTravelMode } from '@/types/travel'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: '대안 비교 — 한적' }

/**
 * [임시] 대안 비교 화면의 자리.
 *
 * 상세 화면의 "대안 보기"가 넘겨준 값(기준 장소·이동수단)이 제대로 도착하는지
 * 확인할 수 있게 해둔 것이다.
 *
 * 정식 화면(PRD ⑤ "대안 비교", Must ③④)은 혼잡+이동+날씨 가중합 스코어링과
 * 1순위 추천 카드가 필요해서 별도 작업이다. 스코어링은 FastAPI 가 맡는다.
 */
export default async function AlternativesPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; mode?: string }>
}) {
  const { from, mode } = await searchParams
  if (!from) redirect('/search')

  const travelMode = toTravelMode(mode)

  const supabase = await createClient()
  const { data: place } = await supabase
    .from('place')
    .select('name, district')
    .eq('id', from)
    .maybeSingle()

  return (
    <DeviceFrame title="대안 비교" backHref={`/place/${from}`}>
      <div className="flex flex-col gap-4 px-6 pt-6 pb-10">
        <section className="bg-card border-line zin rounded-lg border p-4">
          <h2 className="font-display text-muted text-caption font-semibold tracking-[0.08em] uppercase">
            전달받은 값
          </h2>
          <dl className="mt-3 flex flex-col gap-3">
            <div>
              <dt className="text-faint text-caption">기준 장소</dt>
              <dd className="text-ink mt-0.5 text-ui font-semibold">
                {place ? `${place.name} (${place.district ?? '서울'})` : from}
              </dd>
            </div>
            <div>
              <dt className="text-faint text-caption">이동수단</dt>
              <dd className="text-ink mt-0.5 flex items-center gap-1.5 text-ui font-semibold">
                <Icon
                  name={
                    travelMode === 'walk' ? 'directions_walk' : 'directions_car'
                  }
                  size={18}
                />
                {TRAVEL_MODE_LABEL[travelMode]}
              </dd>
            </div>
          </dl>
        </section>

        <p className="text-faint bg-sunk rounded-xs p-3 text-caption leading-relaxed">
          대안 리스트와 비교 뷰는 아직 만들지 않았습니다. 혼잡·이동·날씨를
          합친 스코어링이 필요하고, 그 계산은 FastAPI 예측 서비스가 맡습니다.
        </p>

        <Link
          href={`/place/${from}`}
          className="font-display text-ink border-line-3 hover:border-muted flex min-h-tap items-center justify-center rounded-full border text-ui font-semibold transition-colors"
        >
          상세로 돌아가기
        </Link>
      </div>
    </DeviceFrame>
  )
}
