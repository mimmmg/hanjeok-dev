'use client'

import { SearchResultCard } from '@/components/SearchResultCard'
import { useGeolocation } from '@/hooks/useGeolocation'
import type { PlaceSearchResult } from '@/types/place'

/**
 * 검색 결과 리스트 (PRD ⑤ "검색 결과").
 *
 * 담기 상태는 각 하트가 스스로 관리한다(FavoriteHeart). 목록이 상태를 쥐고
 * 있으면 한 곳을 누를 때마다 목록 전체가 다시 그려지고, 토스트를 띄우려면
 * 응답을 기다려야 해서 조작이 굼뜨게 느껪진다.
 *
 * 목록이 하는 일은 위치를 한 번만 받아 카드에 내려주는 것뿐이다.
 */
export function SearchResultList({
  places,
  initialSavedIds,
}: {
  places: PlaceSearchResult[]
  initialSavedIds: string[]
}) {
  /*
   * 위치는 목록 단위로 한 번만 받는다. 카드마다 요청하면 같은 좌표를
   * 여러 번 받게 되고 권한 창도 어수선해진다. 거부하면 coords 가 null 로
   * 남고 거리 표시만 빠진다 — 검색·담기는 그대로다.
   */
  const geo = useGeolocation()
  const coords = geo.status === 'granted' ? geo.coords : null
  const savedIds = new Set(initialSavedIds)

  return (
    <ul className="flex flex-col gap-3 px-6 pb-5">
      {places.map((place, i) => (
        <li
          key={place.id}
          className="zin"
          style={{ animationDelay: `${Math.min(i, 6) * 0.04}s` }}
        >
          <SearchResultCard
            place={place}
            saved={savedIds.has(place.id)}
            coords={coords}
          />
        </li>
      ))}
    </ul>
  )
}
