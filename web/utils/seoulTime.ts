/**
 * 서울 기준 시각 유틸.
 *
 * 서버(Vercel)는 UTC 로 돈다. new Date().getHours() 를 그냥 쓰면
 * 한국 오전 9시에 서버는 0시를 보고 "새벽이라 한산합니다"를 띄운다.
 * 서비스 지역이 서울 한정이므로 시간대도 서울로 고정한다.
 */

const SEOUL = 'Asia/Seoul'

/** 서울 기준 현재 시각의 '시'(0~23). congestion_forecast.hour_slot 과 맞물린다 */
export function seoulHour(now: Date = new Date()): number {
  const hour = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL,
    hour: 'numeric',
    hour12: false,
  }).format(now)

  // hour12:false 는 자정을 '24'로 주는 환경이 있어 24 → 0 으로 접는다
  return Number(hour) % 24
}

/** 서울 기준 오늘 날짜 YYYY-MM-DD. congestion_forecast.forecast_date 와 맞물린다 */
export function seoulToday(now: Date = new Date()): string {
  // en-CA 로케일이 YYYY-MM-DD 형식을 준다
  return new Intl.DateTimeFormat('en-CA', { timeZone: SEOUL }).format(now)
}
