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
  /**
   * 값의 출처. 'predictor' 는 예측 서비스가 지금 계산한 값,
   * 'cache' 는 예측 서비스가 응답하지 않아 DB 저장분으로 대체한 값이다.
   * 저장분을 실시간처럼 보여주지 않기 위해 화면에서 구분한다.
   */
  source?: 'predictor' | 'cache'
}
