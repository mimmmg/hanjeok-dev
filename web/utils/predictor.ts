import type { Forecast } from '@/types/forecast'

/**
 * FastAPI 예측 서비스 호출 — **서버 전용**.
 *
 * 브라우저에서 부르면 PREDICTOR_API_URL이 undefined라 그냥 실패한다.
 * 이건 사고가 아니라 의도된 방어선이다 (CLAUDE.md §2):
 * 브라우저가 FastAPI를 직접 호출하지 않으므로 CORS 설정이 필요 없고,
 * 예측 서버 주소도 외부에 노출되지 않는다.
 */

/** FastAPI가 죽었거나 느릴 때 사용자를 무한정 기다리게 두지 않는다. */
const TIMEOUT_MS = 5_000

export async function fetchForecast(
  placeId: string,
  forecastDate?: string,
): Promise<Forecast | null> {
  const baseUrl = process.env.PREDICTOR_API_URL
  if (!baseUrl) {
    console.error('PREDICTOR_API_URL이 설정되지 않았습니다.')
    return null
  }

  const url = new URL('/forecast', baseUrl)
  url.searchParams.set('place_id', placeId)
  if (forecastDate) url.searchParams.set('forecast_date', forecastDate)

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
    if (!res.ok) {
      console.error(`예측 서비스 응답 오류: ${res.status}`)
      return null
    }
    return (await res.json()) as Forecast
  } catch (e) {
    // 예측 서비스가 죽어도 검색·즐겨찾기는 계속 동작해야 한다 (PRD ⑦ 가용성).
    // 호출한 쪽에서 null을 받으면 congestion_forecast 테이블의 마지막 저장분으로 대체한다.
    console.error('예측 서비스 호출 실패:', e)
    return null
  }
}
