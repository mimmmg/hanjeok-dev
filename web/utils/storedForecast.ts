import type { Forecast } from '@/types/forecast'
import { seoulToday } from '@/utils/seoulTime'
import { createClient } from '@/utils/supabase/server'

/**
 * congestion_forecast 테이블에 저장된 예측치를 읽는다.
 *
 * 예측 서비스가 응답하지 않을 때 쓰는 대체 경로다. 배치가 미리 계산해
 * 넣어둔 값이 남아 있으므로, FastAPI 가 죽어도 화면은 숫자를 보여줄 수 있다 —
 * PRD ⑦ 의 "FastAPI 가 다운돼도 Next.js·검색·즐겨찾기는 정상 동작해야 함"이
 * 실제로 성립하게 만드는 부분이다.
 *
 * 요청한 날짜가 없으면 그보다 이전 중 가장 최근 것을 준다. 오늘치 배치가
 * 아직 안 돌았을 때 화면이 비는 것보다, 어제 예측이라도 보여주고 그 사실을
 * 밝히는 편이 낫다.
 */
export async function fetchStoredForecast(
  placeId: string,
  forecastDate?: string,
): Promise<Forecast | null> {
  const supabase = await createClient()
  const targetDate = forecastDate ?? seoulToday()

  // 1) 쓸 수 있는 가장 가까운 기준일을 찾는다
  const { data: latest, error: dateError } = await supabase
    .from('congestion_forecast')
    .select('forecast_date')
    .eq('place_id', placeId)
    .lte('forecast_date', targetDate)
    .order('forecast_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (dateError || !latest) return null

  // 2) 그 날짜의 24시간을 가져온다
  const { data: rows, error } = await supabase
    .from('congestion_forecast')
    .select('hour_slot, congestion_pct, computed_at')
    .eq('place_id', placeId)
    .eq('forecast_date', latest.forecast_date)
    .order('hour_slot')

  if (error || !rows?.length) return null

  return {
    place_id: placeId,
    forecast_date: latest.forecast_date,
    computed_at: rows[0].computed_at,
    slots: rows.map((r) => ({
      hour_slot: r.hour_slot,
      congestion_pct: r.congestion_pct,
    })),
    // 저장분은 KTO 집중률로 계산된 실데이터다. mock 이 아니다.
    is_mock: false,
  }
}
