import { NextResponse, type NextRequest } from 'next/server'
import { fetchForecast } from '@/utils/predictor'

/**
 * 브라우저 → 이 Route Handler → FastAPI 로 이어지는 중계 지점.
 * 브라우저가 FastAPI를 직접 부르지 않게 하는 유일한 통로다.
 */
export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('place_id')
  if (!placeId) {
    return NextResponse.json(
      { error: 'place_id 쿼리 파라미터가 필요합니다.' },
      { status: 400 },
    )
  }

  const forecast = await fetchForecast(placeId)
  if (!forecast) {
    // 503: 예측 서비스만 문제인 상태. 호출한 화면은 이 응답을 받고
    // congestion_forecast 테이블의 마지막 저장분으로 넘어가면 된다.
    return NextResponse.json(
      { error: '예측 서비스를 사용할 수 없습니다.' },
      { status: 503 },
    )
  }

  return NextResponse.json(forecast)
}
