import type { Metadata } from 'next'
import { DeviceFrame } from '@/components/DeviceFrame'
import { FavoritesView } from '@/components/FavoritesView'
import type { FavoritePlace } from '@/types/favorite'
import { seoulHour, seoulToday } from '@/utils/seoulTime'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = { title: '관심 장소함 — 한적' }

/**
 * 관심 장소함 (PRD ⑤, Must ⑤).
 *
 * 조회 순서는 PRD ⑥ 에 적힌 그대로다 — user_favorite 에서 해당 사용자의
 * place_id 목록을 먼저 찾고, 그 id 로 place 를 조회한다.
 * 한 번의 중첩 조인으로도 가능하지만, 두 단계로 나누면 예측치 필터를
 * 한 겹에서만 걸면 되어 쿼리가 단순해진다.
 *
 * 익명 세션이 아직 없으면 RLS 가 빈 결과를 주므로 자연스럽게 비어 있음 화면이
 * 된다. 로그인 유도 화면이 따로 필요 없는 게 익명 인증을 택한 이유다.
 */
export default async function FavoritesPage() {
  const supabase = await createClient()
  const hour = seoulHour()
  // 배치가 7일치를 미리 쓰므로 오늘 상한이 없으면 미래 날짜가 뽑힌다
  const today = seoulToday()

  // ① 담아둔 place_id 목록 (RLS 가 본인 것만 준다)
  const { data: rows } = await supabase
    .from('user_favorite')
    .select('place_id, added_at')
    .order('added_at', { ascending: false })

  const addedAtById = new Map((rows ?? []).map((r) => [r.place_id, r.added_at]))
  const placeIds = [...addedAtById.keys()]

  // ② 그 id 로 place + 현재 시간대 예측치
  const { data: places } = placeIds.length
    ? await supabase
        .from('place')
        .select(
          'id, name, category, district, access_desc, fee, congestion_forecast(congestion_pct, forecast_date)',
        )
        .in('id', placeIds)
        .eq('congestion_forecast.hour_slot', hour)
        .lte('congestion_forecast.forecast_date', today)
        .order('forecast_date', {
          referencedTable: 'congestion_forecast',
          ascending: false,
        })
        .limit(1, { referencedTable: 'congestion_forecast' })
    : { data: [] }

  const favorites: FavoritePlace[] = (places ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      district: p.district,
      accessDesc: p.access_desc,
      fee: p.fee,
      congestionPct: p.congestion_forecast[0]?.congestion_pct ?? null,
      addedAt: addedAtById.get(p.id) ?? '',
    }))
    // in() 은 순서를 보장하지 않는다. 담은 순서(최근 먼저)로 다시 세운다
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))

  return (
    <DeviceFrame title="관심 장소함">
      <FavoritesView initialFavorites={favorites} />
    </DeviceFrame>
  )
}
