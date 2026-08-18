/** FastAPI 예측 서비스의 응답 구조. congestion_forecast 테이블과 1:1로 맞춰져 있다. */

export type HourSlot = {
  hour_slot: number // 0~23
  congestion_pct: number // 0~100
}

export type Forecast = {
  place_id: string
  forecast_date: string // YYYY-MM-DD
  computed_at: string // ISO 8601
  slots: HourSlot[]
  /** 실제 KTO 데이터가 아닌 더미인지. UI의 "예측치" 표기 판단에 쓴다. */
  is_mock: boolean
}
