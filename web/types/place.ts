/** 검색 결과 한 줄에 필요한 정보. place + 현재 시간대 혼잡도를 합친 모양이다. */
export type PlaceSearchResult = {
  id: string
  name: string
  district: string | null
  category: string | null
  /** 현재 시간대 혼잡 지수. 예측치가 없으면 null */
  congestionPct: number | null
  /** 그 예측치의 기준일. 오늘이 아니면 화면에서 "예전 예측"임을 알린다 */
  forecastDate: string | null
}
