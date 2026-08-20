import type { HourSlot } from '@/types/forecast'

/** 관심 장소함 한 건. place 정보에 하루치 혼잡 예측을 얹은 모양이다. */
export type FavoritePlace = {
  id: string
  name: string
  category: string | null
  district: string | null
  accessDesc: string | null
  fee: string | null
  /** 현재 시간대 혼잡 지수. 예측치가 없으면 null */
  congestionPct: number | null
  /**
   * 하루치 시간대별 예측. 목록 카드의 하루 흐름 막대에 쓴다.
   * 현재 시각 한 점만 보여주면 "지금 붐빈다"까지만 알 수 있고
   * "이따 가면 되나"는 상세로 들어가야 알 수 있었다.
   */
  slots: HourSlot[]
  /** 가장 붐비는 시각. slots 가 비었으면 null */
  peakHour: number | null
  /** access_desc 에서 읽어낸 역에서 도보 분. 못 읽으면 null */
  transitMinutes: number | null
  /** 내 위치로부터의 거리 계산용. 좌표가 없으면 거리 표시를 생략한다 */
  lat: number | null
  lng: number | null
  /** 담은 시각 — 최근에 담은 것이 위로 온다 */
  addedAt: string
}
