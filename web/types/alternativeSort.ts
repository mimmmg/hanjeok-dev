/**
 * 대안 목록의 정렬 기준.
 *
 * 둘 다 **화면에 보이는 값**으로만 줄을 세운다. 이게 원칙이다.
 * 카드에서 점수 표기를 걷어냈으므로, 안 보이는 숫자로 정렬하면 사용자는
 * 순서가 맞는지 확인할 방법이 없다. 페르소나 페인포인트 ③이
 * "단일 추천은 못 믿는다"인데, 검산 불가능한 순서는 그 불신을 키운다.
 *
 * - calm: 혼잡 지수 오름차순 → 카드의 혼잡 숫자와 순서가 일치
 * - near: 거리 오름차순 → 카드의 km 과 순서가 일치
 *
 * 가중합 점수(`utils/alternativeScore.ts`)는 **정렬이 아니라 선별**에 쓴다.
 * 후보 12곳 중 어느 5곳을 보여줄지 고르는 일이다. 선별까지 정렬 기준으로
 * 하면 "가장 한적한 5곳이 전부 멀어서" 가까운순 탭이 무의미해진다.
 */
export const ALTERNATIVE_SORTS = ['calm', 'near'] as const

export type AlternativeSort = (typeof ALTERNATIVE_SORTS)[number]

export const ALTERNATIVE_SORT_LABEL: Record<AlternativeSort, string> = {
  calm: '한적한순',
  near: '가까운순',
}

/** 1순위 카드 머리에 붙는 말. "1순위 추천"은 쓰지 않는다 — 추천이 아니라 정렬이다 */
export const ALTERNATIVE_SORT_TOP_LABEL: Record<AlternativeSort, string> = {
  calm: '가장 한적한 곳',
  near: '가장 가까운 곳',
}

/**
 * 기본값은 한적한순이다. 도보/차 토글이 이미 거리 상한(3km/15km)을
 * 보장하므로, 한적함을 앞세워도 터무니없이 먼 곳이 1위로 오지 않는다.
 * 범위는 필터가 지키고 순서는 서비스 정체성이 정한다.
 */
export const DEFAULT_ALTERNATIVE_SORT: AlternativeSort = 'calm'

/** URL 쿼리 등 바깥에서 들어온 값을 안전하게 좁힌다 */
export function toAlternativeSort(value: unknown): AlternativeSort {
  return ALTERNATIVE_SORTS.includes(value as AlternativeSort)
    ? (value as AlternativeSort)
    : DEFAULT_ALTERNATIVE_SORT
}
