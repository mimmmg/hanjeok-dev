'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { SearchResultCard } from '@/components/SearchResultCard'
import type { PlaceSearchResult } from '@/types/place'
import { createClient } from '@/utils/supabase/client'
import { ensureAnonymousUser } from '@/utils/supabase/ensureAnonymousUser'

/**
 * 검색 결과 리스트 + 다중선택 담기 (PRD ④ Should, 프로토타입 v2 반영).
 *
 * 페르소나가 "세부 계획을 1주 전에 몰아서 짜는" 습관이라, 한 곳씩 담게 하면
 * 초기 등록 피로도가 커진다. 그래서 체크박스로 여러 곳을 고른 뒤 한 번에 담는다.
 *
 * 익명 계정은 여기서 처음 발급된다 — 담기를 눌러야 계정이 생긴다.
 * 그냥 둘러보고 떠나는 방문자까지 계정을 만들면 빈 계정만 쌓인다.
 */
export function SearchResultList({
  places,
  initialSavedIds,
}: {
  places: PlaceSearchResult[]
  initialSavedIds: string[]
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(
    new Set(initialSavedIds),
  )
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    const ids = [...selected]
    if (ids.length === 0) return

    setSaving(true)
    setError(null)
    try {
      const userId = await ensureAnonymousUser()
      const supabase = createClient()

      // upsert + ignoreDuplicates: 화면에서 이미 막고 있지만, 두 탭에서 동시에
      // 담는 경우처럼 UI 를 통과한 중복이 오면 (user_id, place_id) UNIQUE 가
      // 에러를 낸다. 중복은 "이미 담긴 것"이므로 조용히 넘어가는 게 맞다.
      const { error: insertError } = await supabase
        .from('user_favorite')
        .upsert(
          ids.map((place_id) => ({ user_id: userId, place_id })),
          { onConflict: 'user_id,place_id', ignoreDuplicates: true },
        )

      if (insertError) throw new Error(insertError.message)

      setSavedIds((prev) => new Set([...prev, ...ids]))
      setSelected(new Set())
      setToast(`${ids.length}곳을 관심 장소에 담았어요`)
      setTimeout(() => setToast(null), 2600)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
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
              selected={selected.has(place.id)}
              alreadySaved={savedIds.has(place.id)}
              onToggle={() => toggle(place.id)}
            />
          </li>
        ))}
      </ul>

      {error && (
        <p className="bg-busy-tint text-busy-fg mx-6 mb-4 rounded-xs p-3 text-ui">
          담기에 실패했습니다: {error}
        </p>
      )}

      {/* 하단 고정 담기 바 — 고른 게 있을 때만 나타난다 */}
      {selected.size > 0 && (
        <div className="pointer-events-none sticky bottom-0 z-30 px-4 pb-4">
          <div className="bg-card zin pointer-events-auto flex items-center gap-2.5 rounded-md p-3 shadow-[0_10px_34px_rgb(27_48_34_/_0.18)]">
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              aria-label="선택 해제"
              className="text-body hover:border-terra hover:text-terra-link flex size-10 flex-none items-center justify-center rounded-[11px] border border-[rgb(27_48_34_/_0.12)] transition-colors"
            >
              <Icon name="close" size={19} />
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="font-display bg-terra hover:bg-terra-link flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xs text-base font-bold text-white transition-colors disabled:opacity-60"
            >
              <Icon
                name={saving ? 'progress_activity' : 'favorite'}
                size={19}
                filled={!saving}
                className={saving ? 'animate-spin' : ''}
              />
              {saving ? '담는 중…' : `선택한 ${selected.size}곳 담기`}
            </button>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          className="bg-ink text-screen zin sticky bottom-4 z-30 mx-4 flex items-center gap-2 rounded-md px-4 py-3 text-ui font-medium shadow-[0_10px_30px_rgb(27_48_34_/_0.26)]"
        >
          <Icon name="check_circle" size={20} filled className="text-calm" />
          {toast}
        </div>
      )}
    </>
  )
}
