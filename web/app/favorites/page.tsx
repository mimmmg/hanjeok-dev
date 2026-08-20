import type { Metadata } from 'next'
import { DeviceFrame } from '@/components/DeviceFrame'
import { FavoritesView } from '@/components/FavoritesView'
import type { FavoritePlace } from '@/types/favorite'
import type { HourSlot } from '@/types/forecast'
import { parseWalkMinutes } from '@/utils/alternativeScore'
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

  // ② 그 id 로 place
  const { data: places } = placeIds.length
    ? await supabase
        .from('place')
        .select(
          'id, name, category, district, access_desc, fee, lat, lng',
        )
        .in('id', placeIds)
    : { data: [] }

  /*
   * ③ 하루치 예측 — 목록 카드의 하루 흐름 막대에 쓴다.
   *
   * 예측을 place 안에 끼워 넣지 않고 따로 부르는 이유: 임베드에 걸리는
   * limit 은 부모 한 건당 적용돼서 24행을 받으려면 24로 열어야 하는데,
   * 그러면 여러 기준일이 섞여 들어와 어느 날 것인지 가릴 수 없다.
   * 기준일을 먼저 하나 정하고 그 날의 행만 받는 편이 분명하다.
   *
   * 기준일은 오늘 이하의 최신 하루다. 배치가 모든 장소에 같은 날짜를 쓰므로
   * 장소별로 따로 고르지 않는다.
   */
  const { data: latest } = await supabase
    .from('congestion_forecast')
    .select('forecast_date')
    .lte('forecast_date', today)
    .order('forecast_date', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data: forecastRows } =
    latest && placeIds.length
      ? await supabase
          .from('congestion_forecast')
          .select('place_id, hour_slot, congestion_pct')
          .in('place_id', placeIds)
          .eq('forecast_date', latest.forecast_date)
          .order('hour_slot')
      : { data: [] }

  const slotsByPlace = new Map<string, HourSlot[]>()
  for (const row of forecastRows ?? []) {
    const list = slotsByPlace.get(row.place_id) ?? []
    list.push({ hour_slot: row.hour_slot, congestion_pct: row.congestion_pct })
    slotsByPlace.set(row.place_id, list)
  }

  const favorites: FavoritePlace[] = (places ?? [])
    .map((p) => {
      const slots = slotsByPlace.get(p.id) ?? []

      // 가장 붐비는 시각. 같은 값이면 이른 시각을 남긴다 — 피크가 시작되는
      // 때를 알려주는 편이 "언제 피하면 되는지"에 더 쓸모 있다.
      const peak = slots.reduce<HourSlot | null>(
        (best, s) =>
          best === null || s.congestion_pct > best.congestion_pct ? s : best,
        null,
      )

      return {
        id: p.id,
        name: p.name,
        category: p.category,
        district: p.district,
        accessDesc: p.access_desc,
        fee: p.fee,
        congestionPct:
          slots.find((s) => s.hour_slot === hour)?.congestion_pct ?? null,
        slots,
        // 하루가 통째로 0 이면(휴무일) 피크라고 부를 게 없다
        peakHour: peak && peak.congestion_pct > 0 ? peak.hour_slot : null,
        transitMinutes: parseWalkMinutes(p.access_desc),
        lat: p.lat,
        lng: p.lng,
        addedAt: addedAtById.get(p.id) ?? '',
      }
    })
    // in() 은 순서를 보장하지 않는다. 담은 순서(최근 먼저)로 다시 세운다
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))

  return (
    <DeviceFrame title="관심 장소함">
      <FavoritesView initialFavorites={favorites} />
    </DeviceFrame>
  )
}
