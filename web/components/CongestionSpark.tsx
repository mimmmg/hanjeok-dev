import type { HourSlot } from '@/types/forecast'
import { CONGESTION_STYLE, congestionLevel } from '@/utils/congestionLevel'

/**
 * 하루 혼잡 흐름 미니 막대. prototype/style.css 의 "하루 흐름 스파크"를 옮긴 것.
 *
 * 24개를 그대로 세우지 않고 다섯 칸으로 묶는다. 카드 안에서 24개는 한 칸이
 * 3px 도 안 돼 형태가 안 읽히고, 목록은 여러 곳을 훑는 자리라 정밀한 값이
 * 아니라 "언제 몰리는지"의 모양만 필요하다. 정확한 시간대별 값은
 * 상세 화면의 그래프가 맡는다.
 *
 * 새벽을 버리고 07~21시만 본다. 문 닫은 시간의 0 을 넣으면 막대 절반이
 * 바닥에 붙어 정작 봐야 할 낮 시간의 차이가 눌린다.
 */

/** 3시간씩 다섯 구간. 관람이 실제로 일어나는 시간대만 본다 */
const BUCKETS: [number, number][] = [
  [7, 9],
  [10, 12],
  [13, 15],
  [16, 18],
  [19, 21],
]

/** 값이 0 이어도 막대가 있다는 건 보이게 한다 */
const MIN_HEIGHT_PCT = 6

export function CongestionSpark({
  slots,
  peakHour,
}: {
  slots: HourSlot[]
  /** 접근성 설명에 쓴다. 화면에는 부모가 따로 적는다 */
  peakHour: number | null
}) {
  if (slots.length === 0) return null

  const byHour = new Map(slots.map((s) => [s.hour_slot, s.congestion_pct]))

  const bars = BUCKETS.map(([from, to]) => {
    const values: number[] = []
    for (let h = from; h <= to; h++) {
      const v = byHour.get(h)
      if (v !== undefined) values.push(v)
    }
    if (values.length === 0) return null
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
  })

  if (bars.every((b) => b === null)) return null

  return (
    <div
      className="flex h-7 items-end gap-[3px]"
      role="img"
      aria-label={
        peakHour === null
          ? '하루 혼잡 흐름'
          : `하루 혼잡 흐름. ${peakHour}시에 가장 붐빔`
      }
    >
      {bars.map((pct, i) => (
        <span
          key={BUCKETS[i][0]}
          className={`flex-1 rounded-t-[3px] ${
            pct === null ? 'bg-line-2' : CONGESTION_STYLE[congestionLevel(pct)].fill
          }`}
          style={{ height: `${Math.max(pct ?? 0, MIN_HEIGHT_PCT)}%` }}
        />
      ))}
    </div>
  )
}
