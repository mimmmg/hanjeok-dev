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
  /**
   * 장소 좌표. "내 위치에서 거리"를 브라우저에서 계산하는 데 쓴다.
   * 장소 좌표는 공개 정보라 클라이언트로 내려도 된다 —
   * 감추어야 하는 건 사용자 좌표 쪽이고, 그건 아예 서버로 보내지 않는다.
   */
  lat: number | null
  lng: number | null
}
