'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { createClient } from '@/utils/supabase/client'
import { ensureAnonymousUser } from '@/utils/supabase/ensureAnonymousUser'

/**
 * 관심 장소 담기/빼기 하트.
 *
 * "관심 장소함에 있음" 같은 문장 대신 하트의 채움 여부로 상태를 보여준다.
 * 담긴 상태를 글로 설명하면 한 줄이 더 필요하고, 빼려면 다른 화면으로
 * 가야 한다. 하트는 상태 표시와 조작을 한 자리에서 한다.
 *
 * 익명 계정은 처음 담을 때 발급된다. 그냥 둘러보고 떠나는 방문자까지
 * 계정을 만들면 빈 계정만 쌓인다.
 */
export function FavoriteHeart({
  placeId,
  placeName,
  initialSaved,
  size = 26,
}: {
  placeId: string
  placeName: string
  initialSaved: boolean
  size?: number
}) {
  const [saved, setSaved] = useState(initialSaved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  async function handleClick() {
    setBusy(true)
    setError(false)
    try {
      const supabase = createClient()

      if (saved) {
        // RLS 가 본인 행으로 제한하므로 user_id 조건을 따로 걸지 않아도 안전하다
        const { error: deleteError } = await supabase
          .from('user_favorite')
          .delete()
          .eq('place_id', placeId)
        if (deleteError) throw new Error(deleteError.message)
        setSaved(false)
      } else {
        const userId = await ensureAnonymousUser()
        const { error: insertError } = await supabase
          .from('user_favorite')
          .upsert(
            { user_id: userId, place_id: placeId },
            { onConflict: 'user_id,place_id', ignoreDuplicates: true },
          )
        if (insertError) throw new Error(insertError.message)
        setSaved(true)
      }
    } catch {
      // 실패를 문장으로 늘어놓기보다 하트 색으로 알린다.
      // 다시 누르면 재시도되므로 사용자가 할 일은 명확하다.
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      aria-pressed={saved}
      aria-label={`${placeName} ${saved ? '관심 장소에서 빼기' : '관심 장소에 담기'}`}
      className="flex size-tap flex-none items-center justify-center rounded-full transition-colors hover:bg-[rgb(27_48_34_/_0.05)] disabled:opacity-50"
    >
      <Icon
        name={busy ? 'progress_activity' : error ? 'error' : 'favorite'}
        size={size}
        filled={saved && !error}
        className={
          busy
            ? 'text-muted animate-spin'
            : error
              ? 'text-busy'
              : saved
                ? 'text-terra'
                : 'text-faint'
        }
      />
    </button>
  )
}
