'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { createClient } from '@/utils/supabase/client'
import { ensureAnonymousUser } from '@/utils/supabase/ensureAnonymousUser'

/**
 * 관심 장소 담기/빼기 하트.
 *
 * "관심 장소함에 있음" 같은 문장 대신 하트의 채움으로 상태를 보여준다.
 * 담긴 상태를 글로 설명하면 한 줄이 더 필요하고, 빼려면 다른 화면으로
 * 가야 한다. 하트는 상태 표시와 조작을 한 자리에서 한다.
 *
 * 낙관적 갱신(optimistic update)을 쓴다 — 누르는 즉시 하트를 바꾸고
 * 저장은 뒤에서 한다. 응답을 기다린 뒤 바꾸면 스피너가 보이면서
 * 조작이 굼뜨게 느껪진다. 찜하기는 실패해도 잃는 것이 크지 않은 조작이라
 * 먼저 반영하고 실패했을 때만 되돌리는 편이 낫다.
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
  const [failed, setFailed] = useState(false)

  async function handleClick() {
    const next = !saved

    // 먼저 화면을 바꾼다
    setSaved(next)
    setFailed(false)

    try {
      const supabase = createClient()

      if (next) {
        const userId = await ensureAnonymousUser()
        const { error } = await supabase
          .from('user_favorite')
          .upsert(
            { user_id: userId, place_id: placeId },
            { onConflict: 'user_id,place_id', ignoreDuplicates: true },
          )
        if (error) throw new Error(error.message)
      } else {
        // RLS 가 본인 행으로 제한하므로 user_id 조건을 따로 걸지 않아도 안전하다
        const { error } = await supabase
          .from('user_favorite')
          .delete()
          .eq('place_id', placeId)
        if (error) throw new Error(error.message)
      }
    } catch {
      // 실패했으면 되돌린다. 화면과 DB 가 어긋난 채로 두는 게 가장 나쁘다.
      setSaved(!next)
      setFailed(true)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-pressed={saved}
      aria-label={`${placeName} ${saved ? '관심 장소에서 빼기' : '관심 장소에 담기'}`}
      className="flex size-tap flex-none items-center justify-center rounded-full transition-colors hover:bg-[rgb(27_48_34_/_0.05)]"
    >
      <Icon
        name="favorite"
        size={size}
        filled={saved}
        // 색 전환만 짧게 준다. 크기가 튀는 효과는 목록에서 여러 개를
        // 연달아 누를 때 화면이 들썩여 오히려 산만해진다.
        className={`transition-colors duration-150 ${
          failed ? 'text-busy' : saved ? 'text-terra' : 'text-faint'
        }`}
      />
      {failed && <span className="sr-only">담기에 실패했습니다</span>}
    </button>
  )
}
