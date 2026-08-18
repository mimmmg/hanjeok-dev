/**
 * Material Symbols 아이콘 목록 — 여기가 단일 관리 지점이다.
 *
 * 아이콘 가변폰트 전체는 약 3.9MB라 그대로 받으면 모바일에서 부담이다.
 * Google Fonts의 icon_names 파라미터로 여기 적힌 것만 잘라서 받는다.
 *
 * 함정과 방어:
 * 목록에 없는 아이콘을 쓰면 글리프가 없어 이름이 글자 그대로 보인다
 * ("check_circle" 이 그대로 노출). 그래서 IconName 타입으로 묶어
 * 목록에 없는 이름을 쓰면 TypeScript가 먼저 잡게 했다.
 *
 * 새 아이콘을 쓰려면 이 배열에 추가하기만 하면 된다.
 * 이름은 https://fonts.google.com/icons 에서 확인한다.
 */
export const ICON_NAMES = [
  'arrow_back',
  'arrow_forward',
  'check',
  'check_circle',
  'close',
  'compare_arrows',
  'directions_car',
  'directions_walk',
  'error',
  'favorite',
  'fingerprint',
  'info',
  'progress_activity',
  'search',
  'travel_explore',
] as const

export type IconName = (typeof ICON_NAMES)[number]

/** 위 목록만 담은 서브셋 스타일시트 URL. layout.tsx 에서 <link> 로 싣는다. */
export const ICON_FONT_URL =
  'https://fonts.googleapis.com/css2' +
  '?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,0' +
  `&icon_names=${[...ICON_NAMES].sort().join(',')}` +
  '&display=block'
