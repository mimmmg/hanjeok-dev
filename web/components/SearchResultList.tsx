'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { SearchResultCard } from '@/components/SearchResultCard'
import { useGeolocation } from '@/hooks/useGeolocation'
import type { PlaceSearchResult } from '@/types/place'
import { createClient } from '@/utils/supabase/client'
import { ensureAnonymousUser } from '@/utils/supabase/ensureAnonymousUser'

/**
 * 검색 결과 리스트 (PRD ⑤ "검색 결과").
 *
 * 하트를 누르면 그 자리에서 담기고, 다시 누르면 빠진다. 고른 뒤 확인하는
 * 단계가 없어서 여러 곳을 연달아 담기 좋다 — PRD ④ 가 다중선택을 넣은 이유가
 * "하나하나 넣기 귀찮다" 였는데, 확인 단계를 없애는 쪽이 그 목적에 더 맞는다.
 *
 * 익명 계정은 처음 담을 때 발급된다. 그냥 둘러보고 떠나는 방문자까지
 * 계정을 만들면 빈 계정만 쌓인다.
 */
export function SearchResultList({
  places,
  initialSavedIds,
}: {
  places: PlaceSearchResult[]
  initialSavedIds: string[]
}) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set(initialSavedIds))
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  /*
   * 위치는 목록 단위로 한 번만 받아 각 카드에 내려준다.
   * 카드마다 요청하면 같은 좌표를 여러 번 받게 되고, 권한 창도 어수선해진다.
   * 거부하면 coords 가 null 로 남고 거리 표시만 빠진다 — 검색·담기는 그대로다.
   */
  const geo = useGeolocation()
  const coords = geo.status === 'granted' ? geo.coords : null

  function showToast(message: string) {
    setToast(message)
    setTimeout(() => setToast(null), 2400)
  }

  async function handleToggle(place: PlaceSearchResult) {
    const isSaved = savedIds.has(place.id)
    setSavingId(place.id)
    setError(null)

    try {
      const supabase = createClient()

      if (isSaved) {
        // RLS 가 본인 행으로 제한하므로 user_id 조건을 따로 걸지 않아도 안전하다
        const { error: deleteError } = await supabase
          .from('user_favorite')
          .delete()
          .eq('place_id', place.id)
        if (deleteError) throw new Error(deleteError.message)

        setSavedIds((prev) => {
          const next = new Set(prev)
          next.delete(place.id)
          return next
        })
        showToast(`${place.name}을(를) 뺐어요`)
      } else {
        const userId = await ensureAnonymousUser()
        // 두 탭에서 동시에 담는 경우처럼 UI 를 통과한 중복이 오면
        // (user_id, place_id) UNIQUE 가 에러를 낸다. 중복은 "이미 담긴 것"이므로
        // 조용히 넘어가는 게 맞다.
        const { error: insertError } = await supabase
          .from('user_favorite')
          .upsert(
            { user_id: userId, place_id: place.id },
            { onConflict: 'user_id,place_id', ignoreDuplicates: true },
          )
        if (insertError) throw new Error(insertError.message)

        setSavedIds((prev) => new Set(prev).add(place.id))
        showToast(`${place.name}을(를) 담았어요`)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <>
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
              saving={savingId === place.id}
              onToggleSave={() => handleToggle(place)}
              coords={coords}
            />
          </li>
        ))}
      </ul>

      {error && (
        <p className="bg-busy-tint text-busy-fg mx-6 mb-4 rounded-xs p-3 text-ui">
          담기에 실패했습니다: {error}
        </p>
      )}

      {toast && (
        <div
          role="status"
          className="bg-ink text-screen zin sticky bottom-4 z-30 mx-4 flex items-center gap-2 rounded-md px-4 py-3 text-ui font-medium shadow-[0_10px_30px_rgb(27_48_34_/_0.26)]"
        >
          <Icon name="check_circle" size={20} filled className="text-calm" />
          <span className="flex-1">{toast}</span>
          <Link
            href="/favorites"
            className="font-display text-calm flex-none text-ui font-bold underline underline-offset-2"
          >
            보러가기
          </Link>
        </div>
      )}
    </>
  )
}
