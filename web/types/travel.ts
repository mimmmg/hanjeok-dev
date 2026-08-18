/**
 * 이동수단. PRD ④의 Should — 실제 인터뷰에서 확인된 행동 패턴을 반영한다.
 * "도보면 최대 1시간 기다리지만, 차로 이동했거나 동반자가 있으면 즉시 이탈."
 *
 * 대안 스코어링에서 이동시간 가중치를 바꾸는 데 쓴다. 도보는 가까운 곳에,
 * 차는 조금 멀어도 여유로운 곳에 무게를 둔다.
 */
export const TRAVEL_MODES = ['walk', 'car'] as const

export type TravelMode = (typeof TRAVEL_MODES)[number]

export const TRAVEL_MODE_LABEL: Record<TravelMode, string> = {
  walk: '도보',
  car: '차',
}

/** URL 쿼리 등 바깥에서 들어온 값을 안전하게 좁힌다 */
export function toTravelMode(value: unknown): TravelMode {
  return TRAVEL_MODES.includes(value as TravelMode)
    ? (value as TravelMode)
    : 'walk'
}
