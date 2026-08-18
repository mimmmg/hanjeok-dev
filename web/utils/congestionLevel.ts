/**
 * 혼잡 지수(0~100)를 3구간으로 나눈다.
 *
 * 경계값 45 / 70은 prototype/style.css 의 브리프에서 온 것이다
 * ("70↑ 혼잡 / 45↑ 보통 / 그 아래 여유").
 * 게이지에 이 경계선을 함께 그리기 때문에, 여기 값을 바꾸면
 * CongestionGauge 의 눈금 위치도 같이 바꿔야 한다.
 */

export const CONGESTION_THRESHOLDS = { mid: 45, busy: 70 } as const

export type CongestionLevel = 'calm' | 'mid' | 'busy'

export function congestionLevel(pct: number): CongestionLevel {
  if (pct >= CONGESTION_THRESHOLDS.busy) return 'busy'
  if (pct >= CONGESTION_THRESHOLDS.mid) return 'mid'
  return 'calm'
}

export const CONGESTION_LABEL: Record<CongestionLevel, string> = {
  calm: '여유',
  mid: '보통',
  busy: '혼잡',
}

/** 구간별 Tailwind 클래스. 토큰 이름과 1:1로 대응한다. */
export const CONGESTION_STYLE: Record<
  CongestionLevel,
  { fill: string; tint: string; fg: string }
> = {
  calm: { fill: 'bg-calm', tint: 'bg-calm-tint', fg: 'text-calm-fg' },
  mid: { fill: 'bg-mid', tint: 'bg-mid-tint', fg: 'text-mid-fg' },
  busy: { fill: 'bg-busy', tint: 'bg-busy-tint', fg: 'text-busy-fg' },
}
