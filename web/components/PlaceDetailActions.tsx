'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Icon } from '@/components/Icon'
import {
  TRAVEL_MODE_LABEL,
  TRAVEL_MODES,
  type TravelMode,
} from '@/types/travel'
import { CONGESTION_THRESHOLDS } from '@/utils/congestionLevel'
import { createClient } from '@/utils/supabase/client'
import { ensureAnonymousUser } from '@/utils/supabase/ensureAnonymousUser'

/**
 * 상세 화면의 조작부 — 도보/차 토글, 담기, 대안 보기.
 *
 * 셋을 한 컴포넌트에 둔 이유: 도보/차 상태를 "대안 보기" 링크가 함께 써야 한다.
 * 상태를 위로 끌어올리면 상세 화면 전체가 클라이언트 컴포넌트가 되어
 * 서버에서 하던 조회까지 브라우저로 내려간다.
 */
export function PlaceDetailActions({
  placeId,
  placeName,
  currentPct,
  initiallySaved,
}: {
  placeId: string
  placeName: string
  /** 현재 시간대 혼잡 지수. null 이면 예측치가 없다 */
  currentPct: number | null
  initiallySaved: boolean
}) {
  const [mode, setMode] = useState<TravelMode>('walk')
  const [saved, setSaved] = useState(initiallySaved)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /*
   * 혼잡 기준을 넘을 때만 "대안 보기"를 노출한다 (PRD ⑤ 분기 로직).
   * 한적한 곳을 보고 있는 사람에게 대안을 들이미는 건 방해다.
   */
  const showAlternatives =
    currentPct !== null && currentPct >= CONGESTION_THRESHOLDS.busy

  async function handleSave() {
    if (saved) return
    setSaving(true)
    setError(null)
    try {
      const userId = await ensureAnonymousUser()
      const supabase = createClient()
      const { error: saveError } = await supabase
        .from('user_favorite')
        .upsert(
          { user_id: userId, place_id: placeId },
          { onConflict: 'user_id,place_id', ignoreDuplicates: true },
        )
      if (saveError) throw new Error(saveError.message)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── 이동수단 토글 ── */}
      <div>
        <div
          role="group"
          aria-label="이동수단"
          className="bg-card inline-flex rounded-xs p-1 shadow-[0_2px_10px_rgb(27_48_34_/_0.05)]"
        >
          {TRAVEL_MODES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`font-display flex items-center gap-1.5 rounded-[9px] px-3.5 py-2 text-label font-semibold transition-colors ${
                mode === m ? 'bg-terra text-white' : 'text-body'
              }`}
            >
              <Icon
                name={m === 'walk' ? 'directions_walk' : 'directions_car'}
                size={17}
              />
              {TRAVEL_MODE_LABEL[m]}
            </button>
          ))}
        </div>
        <p className="text-muted mt-2 text-caption leading-relaxed">
          {mode === 'walk'
            ? '걸어서 갈 수 있는 가까운 곳 위주로 대안을 찾습니다.'
            : '조금 멀어도 한적한 곳 위주로 대안을 찾습니다.'}
        </p>
      </div>

      {/* ── 담기 · 대안 보기 ── */}
      <div className="flex flex-col gap-2.5">
        <button
          type="button"
          onClick={handleSave}
          disabled={saved || saving}
          className={`font-display flex min-h-14 items-center justify-center gap-2 rounded-full px-5 text-base font-bold transition-colors ${
            saved
              ? 'border-terra-bd bg-terra-tint text-terra-dark cursor-default border'
              : 'bg-terra hover:bg-terra-link text-white disabled:opacity-60'
          }`}
        >
          <Icon
            name={saving ? 'progress_activity' : saved ? 'check' : 'favorite'}
            size={20}
            filled={!saving && !saved}
            className={saving ? 'animate-spin' : ''}
          />
          {saving ? '담는 중…' : saved ? '관심 장소함에 있음' : '관심 장소에 담기'}
        </button>

        {showAlternatives && (
          <Link
            href={`/place/${placeId}/alternatives?mode=${mode}`}
            className="font-display text-ink flex min-h-14 items-center justify-center gap-2 rounded-full border border-[rgb(27_48_34_/_0.14)] px-5 text-base font-bold transition-colors hover:bg-[rgb(27_48_34_/_0.04)]"
          >
            <Icon name="compare_arrows" size={20} />
            한적한 대안 보기
          </Link>
        )}
      </div>

      {showAlternatives && (
        <p className="bg-calm-tint text-calm-fg flex items-start gap-2 rounded-xs border border-[rgb(170_166_72_/_0.34)] p-3 text-caption leading-relaxed">
          <Icon name="info" size={16} className="mt-px" />
          <span>
            지금 {placeName}은(는) 붐빕니다. 비슷한 분위기의 한적한 곳을 나란히
            비교해 보세요.
          </span>
        </p>
      )}

      {error && (
        <p className="bg-busy-tint text-busy-fg rounded-xs p-3 text-ui">
          담기에 실패했습니다: {error}
        </p>
      )}
    </div>
  )
}
