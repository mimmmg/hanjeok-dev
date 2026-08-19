'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { FavoriteListItem } from '@/components/FavoriteListItem'
import { GlanceCard } from '@/components/GlanceCard'
import { Icon } from '@/components/Icon'
import type { FavoritePlace } from '@/types/favorite'
import { createClient } from '@/utils/supabase/client'

type ViewMode = 'list' | 'glance'

/**
 * 관심 장소함 (PRD ⑤ "관심 장소함", Must ⑤).
 *
 * 저니맵에서 확인된 "여러 장소를 모아 훑어보고 싶다"는 니즈에 대응해
 * 목록/하나씩 훑기 두 모드를 둔다. 목록은 담아둔 것을 확인하는 화면이고,
 * 훑기는 그중 어디로 갈지 고르는 화면이라 역할이 다르다.
 *
 * 스와이프는 CSS scroll-snap 으로 구현했다. framer-motion 같은 라이브러리를
 * 쓰면 관성 스크롤·터치·트랙패드·키보드 이동을 전부 다시 만들어야 하는데,
 * 브라우저가 이미 다 해주는 일이다.
 */
export function FavoritesView({
  initialFavorites,
}: {
  initialFavorites: FavoritePlace[]
}) {
  const [mode, setMode] = useState<ViewMode>('list')
  const [favorites, setFavorites] = useState(initialFavorites)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [index, setIndex] = useState(0)

  const trackRef = useRef<HTMLUListElement>(null)

  async function handleRemove(placeId: string) {
    setRemovingId(placeId)
    setError(null)
    try {
      const supabase = createClient()
      // RLS 가 본인 행으로 제한하므로 user_id 조건을 따로 걸지 않아도 안전하다
      const { error: deleteError } = await supabase
        .from('user_favorite')
        .delete()
        .eq('place_id', placeId)

      if (deleteError) throw new Error(deleteError.message)

      setFavorites((prev) => prev.filter((f) => f.id !== placeId))
      setIndex((i) => Math.max(0, Math.min(i, favorites.length - 2)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRemovingId(null)
    }
  }

  /** 스크롤 위치로 현재 카드 번호를 알아낸다 */
  function handleTrackScroll() {
    const el = trackRef.current
    if (!el) return
    const card = el.firstElementChild as HTMLElement | null
    if (!card) return
    // gap 을 포함한 한 장의 실제 폭
    const step = card.offsetWidth + 12
    setIndex(Math.round(el.scrollLeft / step))
  }

  if (favorites.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="bg-card text-terra flex size-16 items-center justify-center rounded-full shadow-[0_2px_14px_rgb(27_48_34_/_0.06)]">
          <Icon name="favorite" size={30} />
        </span>
        <p className="font-display text-lead font-semibold">
          아직 담아둔 곳이 없어요
        </p>
        <p className="text-muted text-label leading-relaxed">
          검색 결과에서 여러 곳을 한 번에 담을 수 있습니다.
          <br />
          담아두면 지금 혼잡도를 모아서 볼 수 있어요.
        </p>
        <Link
          href="/search"
          className="font-display bg-terra hover:bg-terra-link mt-2 flex min-h-tap items-center rounded-full px-5 text-ui font-bold text-white transition-colors"
        >
          장소 검색하러 가기
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 px-6 pt-5 pb-10">
      {/* ── 모드 전환 ── */}
      <div
        role="tablist"
        aria-label="보기 방식"
        className="bg-sunk zin flex gap-1 rounded-full p-1"
      >
        {(
          [
            ['list', 'list', '목록'],
            ['glance', 'style', '하나씩 훑기'],
          ] as const
        ).map(([value, icon, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`font-display flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-full text-label font-semibold transition-colors ${
              mode === value ? 'bg-terra text-white' : 'text-body'
            }`}
          >
            <Icon name={icon} size={18} />
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p className="bg-busy-tint text-busy-fg rounded-xs p-3 text-ui">
          해제에 실패했습니다: {error}
        </p>
      )}

      {mode === 'list' ? (
        <>
          <p className="text-faint text-caption">
            왼쪽으로 밀면 담기를 해제할 수 있어요.
          </p>
          <ul className="flex flex-col gap-3">
            {favorites.map((place, i) => (
              <li
                key={place.id}
                className="zin"
                style={{ animationDelay: `${Math.min(i, 6) * 0.04}s` }}
              >
                <FavoriteListItem
                  place={place}
                  onRemove={() => handleRemove(place.id)}
                  removing={removingId === place.id}
                />
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <p className="font-display tabular text-muted text-center text-label">
            {Math.min(index + 1, favorites.length)} / {favorites.length}
          </p>

          {/*
            scroll-snap 캐러셀. 좌우 여백을 음수 마진으로 화면 끝까지 늘려
            카드가 가운데 오면서도 옆 카드가 살짝 보이게 한다.
          */}
          <ul
            ref={trackRef}
            onScroll={handleTrackScroll}
            className="-mx-6 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {favorites.map((place) => (
              <li
                key={place.id}
                className="w-[calc(100%-1.5rem)] flex-none snap-center"
              >
                <GlanceCard
                  place={place}
                  onRemove={() => handleRemove(place.id)}
                  removing={removingId === place.id}
                />
              </li>
            ))}
          </ul>

          {/* 위치 표시 점 — 몇 장 남았는지 감이 오게 */}
          {favorites.length > 1 && (
            <div className="flex justify-center gap-1.5" aria-hidden>
              {favorites.map((f, i) => (
                <span
                  key={f.id}
                  className={`size-1.5 rounded-full transition-colors ${
                    i === index ? 'bg-terra' : 'bg-line-2'
                  }`}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
