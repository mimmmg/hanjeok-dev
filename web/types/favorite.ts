/** 관심 장소함 한 건. place 정보에 현재 시간대 혼잡도를 얹은 모양이다. */
export type FavoritePlace = {
  id: string
  name: string
  category: string | null
  district: string | null
  accessDesc: string | null
  fee: string | null
  /** 현재 시간대 혼잡 지수. 예측치가 없으면 null */
  congestionPct: number | null
  /** 담은 시각 — 최근에 담은 것이 위로 온다 */
  addedAt: string
}
