import {
  CONGESTION_LABEL,
  CONGESTION_STYLE,
  congestionLevel,
} from '@/utils/congestionLevel'

/**
 * 혼잡도 배지. 검색 결과 리스트·대안 카드·상세화면에서 공통으로 쓴다.
 * prototype/style.css 의 .tag / .tag-busy|mid|calm 을 옮긴 것.
 */
export function CongestionTag({
  pct,
  showPct = true,
}: {
  pct: number
  showPct?: boolean
}) {
  const level = congestionLevel(pct)
  const { tint, fg } = CONGESTION_STYLE[level]

  return (
    <span
      className={`font-display inline-flex items-center gap-1 rounded-full px-3 py-[5px] text-caption font-semibold whitespace-nowrap ${tint} ${fg}`}
    >
      {CONGESTION_LABEL[level]}
      {showPct && <span className="tabular">{pct}</span>}
    </span>
  )
}
