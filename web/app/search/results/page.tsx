import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DeviceFrame } from '@/components/DeviceFrame'
import { Icon } from '@/components/Icon'
import { SearchForm } from '@/components/SearchForm'
import { SearchResultList } from '@/components/SearchResultList'
import type { PlaceSearchResult } from '@/types/place'
import { escapeLikePattern } from '@/utils/escapeLikePattern'
import { seoulHour, seoulToday } from '@/utils/seoulTime'
import { createClient } from '@/utils/supabase/server'

export const metadata: Metadata = {
  title: '검색 결과 — 한적',
}

/** 한 번에 보여줄 최대 개수. 서울 한정 MVP 라 이 이상은 스크롤 피로만 준다 */
const RESULT_LIMIT = 30

export default async function SearchResultsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const query = q?.trim()

  // 검색어 없이 들어오면 진입 화면으로 돌려보낸다
  if (!query) redirect('/search')

  const supabase = await createClient()
  const hour = seoulHour()
  const today = seoulToday()

  /*
   * place 를 이름 부분일치로 찾고, 각 장소의 "현재 시간대" 예측치를 함께 가져온다.
   *
   * forecast_date 를 내림차순으로 1건만 가져오는 이유:
   * 오늘치가 없으면 가장 최근 예측치라도 보여주기 위함이다. 예측 배치가
   * 멈춰도 화면이 비지 않아야 한다는 PRD ⑦ 가용성 요구를 조회 단에서 지킨다.
   */
  const { data, error } = await supabase
    .from('place')
    .select(
      'id, name, district, category, lat, lng, congestion_forecast(congestion_pct, forecast_date)',
    )
    .ilike('name', `%${escapeLikePattern(query)}%`)
    .eq('congestion_forecast.hour_slot', hour)
    .order('forecast_date', {
      referencedTable: 'congestion_forecast',
      ascending: false,
    })
    .limit(1, { referencedTable: 'congestion_forecast' })
    .limit(RESULT_LIMIT)

  const places: PlaceSearchResult[] = (data ?? []).map((row) => {
    const forecast = row.congestion_forecast[0]
    return {
      id: row.id,
      name: row.name,
      district: row.district,
      category: row.category,
      congestionPct: forecast?.congestion_pct ?? null,
      forecastDate: forecast?.forecast_date ?? null,
      lat: row.lat,
      lng: row.lng,
    }
  })

  // 붐비는 곳을 아래로 — 한적한 곳을 먼저 보여주는 게 이 서비스의 존재 이유다.
  // 예측이 없는 곳은 판단 근거가 없으므로 맨 뒤로 보낸다.
  places.sort(
    (a, b) => (a.congestionPct ?? 101) - (b.congestionPct ?? 101),
  )

  /*
   * 이미 담긴 장소. RLS 가 auth.uid() = user_id 로 제한하므로
   * 익명 세션이 아직 없으면 그냥 빈 배열이 온다 (에러가 아니다).
   */
  const { data: favorites } = await supabase
    .from('user_favorite')
    .select('place_id')

  const savedIds = (favorites ?? []).map((f) => f.place_id)

  // 오늘치 예측이 하나도 없으면 화면에서 그 사실을 밝힌다
  const isStale =
    places.length > 0 &&
    places.every((p) => p.forecastDate !== null && p.forecastDate !== today)

  return (
    <DeviceFrame title="검색 결과" backHref="/search" showTabBar>
      <div className="px-6 pt-5 pb-4">
        <SearchForm initialQuery={query} />

        <div className="mt-4 flex items-baseline justify-between gap-3">
          <p className="text-muted text-label">
            <span className="text-ink font-semibold">{query}</span> 검색 결과{' '}
            <span className="tabular">{places.length}</span>곳
          </p>
          <p className="text-faint text-caption">
            {hour}시 기준 · 한적한 순
          </p>
        </div>

        <p className="text-faint mt-1 text-micro leading-relaxed">
          KTO 공공데이터를 바탕으로 계산한 <strong>예측치</strong>입니다. 실시간
          집계가 아닙니다.
          {isStale && ' 오늘 예측이 아직 없어 최근 예측치를 보여드립니다.'}
        </p>
      </div>

      {error ? (
        <p className="bg-busy-tint text-busy-fg mx-6 rounded-xs p-4 text-ui">
          검색에 실패했습니다: {error.message}
        </p>
      ) : places.length === 0 ? (
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <span className="bg-card text-terra flex size-16 items-center justify-center rounded-full shadow-[0_2px_14px_rgb(27_48_34_/_0.06)]">
            <Icon name="travel_explore" size={30} />
          </span>
          <p className="font-display text-lead font-semibold">
            찾는 장소가 없어요
          </p>
          <p className="text-muted text-label leading-relaxed">
            다른 이름으로 검색해 보세요.
            <br />
            지금은 서울 관광지만 담고 있습니다.
          </p>
          <Link
            href="/search"
            className="font-display border-line-3 text-ink hover:border-muted mt-2 flex min-h-tap items-center rounded-full border px-4 text-ui font-semibold transition-colors"
          >
            다시 검색하기
          </Link>
        </div>
      ) : (
        <SearchResultList places={places} initialSavedIds={savedIds} />
      )}
    </DeviceFrame>
  )
}
