import type { Metadata } from 'next'
import { DeviceFrame } from '@/components/DeviceFrame'
import { SearchForm } from '@/components/SearchForm'
import { SuggestChips, type SuggestPlace } from '@/components/SuggestChips'
import { seoulHour } from '@/utils/seoulTime'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: '탐색 — 한적',
}

/** 추천 칩 개수. 한 줄 반 정도가 훑기 편하다 */
const SUGGEST_LIMIT = 5

/**
 * 검색 진입 화면 (PRD ⑤ "검색 진입").
 *
 * 원래는 입력과 버튼만 두고 아무 데이터도 읽지 않는 화면이었다.
 * 추천 칩을 넣으면서 동적 렌더로 바뀌었다 — 이 변경의 근거는 PRD ② 다:
 * "혼잡도를 고려하는 습관이 없다"는 게 근본 원인이므로, 검색을 하기 전에
 * 이미 혼잡도가 눈에 들어오는 편이 서비스 취지에 맞다.
 *
 * MVP 는 서울 한정이라 지역 선택 UI 는 두지 않는다.
 */
export default async function SearchPage() {
  const supabase = await createClient()
  const hour = seoulHour()

  /*
   * 오늘 정점이 높은 곳 = 사람이 많이 찾는 곳으로 본다.
   * 별도 인기도 컬럼이 없어 예측치를 대리 지표로 쓴다.
   * 점에 표시하는 값은 정점이 아니라 "지금" 혼잡도다 —
   * 유명한 곳들의 현재 상태가 섞여 보여야 비교가 된다.
   */
  const { data } = await supabase
    .from('place')
    .select('id, name, congestion_forecast(congestion_pct, hour_slot)')
    .not('lat', 'is', null)
    .order('congestion_pct', {
      referencedTable: 'congestion_forecast',
      ascending: false,
    })
    .limit(SUGGEST_LIMIT * 6)

  const places: SuggestPlace[] = (data ?? [])
    .map((row) => {
      const slots = row.congestion_forecast ?? []
      const peak = slots.reduce((max, s) => Math.max(max, s.congestion_pct), 0)
      const now = slots.find((s) => s.hour_slot === hour)
      return {
        id: row.id,
        name: row.name,
        congestionPct: now?.congestion_pct ?? null,
        peak,
      }
    })
    .sort((a, b) => b.peak - a.peak)
    .slice(0, SUGGEST_LIMIT)
    .map(({ id, name, congestionPct }) => ({ id, name, congestionPct }))

  return (
    <DeviceFrame title="탐색">
      <div className="flex flex-col gap-8 px-6 pt-6 pb-10">
        <div>
          <div className="zin">
            <h2 className="font-display text-[26px] leading-[1.25] font-bold tracking-[-0.02em]">
              어디로 떠나고 싶으세요?
            </h2>
            <p className="text-muted mt-2 text-label">
              장소를 입력하면 지금 혼잡도부터 보여드려요.
            </p>
          </div>

          <div className="zin mt-5 [animation-delay:0.06s]">
            <SearchForm />
          </div>
        </div>

        <div className="zin [animation-delay:0.12s]">
          <SuggestChips places={places} />
        </div>
      </div>
    </DeviceFrame>
  )
}
