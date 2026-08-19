import { NextResponse, type NextRequest } from 'next/server'
import { fetchForecast } from '@/utils/predictor'
import { fetchStoredForecast } from '@/utils/storedForecast'

/**
 * 브라우저 → 이 Route Handler → FastAPI 로 이어지는 중계 지점.
 *
 * 브라우저가 예측 서비스로 갈 수 있는 유일한 통로다. FastAPI 주소는
 * PREDICTOR_URL 서버 환경변수로만 관리되고, NEXT_PUBLIC_ 이 없어
 * 브라우저 번들에 들어가지 않는다 (CLAUDE.md §2).
 *
 * 가용성 (PRD ⑦):
 * FastAPI 가 응답하지 않으면 congestion_forecast 에 저장된 최근 예측치로
 * 대체한다. 배치가 미리 계산해둔 값이 남아 있으므로 예측 서비스가 죽어도
 * 화면은 숫자를 보여준다. 둘 다 실패할 때만 503 이다.
 *
 * 응답에 source 를 실어 보내 화면이 "지금 계산한 값"과 "저장된 값"을
 * 구분할 수 있게 한다. 저장분을 실시간인 것처럼 보여주면
 * 데이터 신뢰성 표기 원칙에 어긋난다.
 */
export async function GET(request: NextRequest) {
  const placeId = request.nextUrl.searchParams.get('place_id')
  if (!placeId) {
    return NextResponse.json(
      { error: 'place_id 쿼리 파라미터가 필요합니다.' },
      { status: 400 },
    )
  }

  const forecastDate =
    request.nextUrl.searchParams.get('forecast_date') ?? undefined

  // 1차: 예측 서비스에 물어본다
  const live = await fetchForecast(placeId, forecastDate)
  if (live) {
    return NextResponse.json({ ...live, source: 'predictor' })
  }

  // 2차: 저장된 예측치로 대체
  const stored = await fetchStoredForecast(placeId, forecastDate)
  if (stored) {
    console.error(
      `예측 서비스 응답 없음 — 저장분으로 대체 (place_id=${placeId}, 기준일=${stored.forecast_date})`,
    )
    return NextResponse.json({ ...stored, source: 'cache' })
  }

  // 둘 다 없으면 진짜로 보여줄 게 없다
  console.error(`예측치를 찾지 못했습니다 (place_id=${placeId})`)
  return NextResponse.json(
    { error: '예측치를 사용할 수 없습니다.' },
    { status: 503 },
  )
}
