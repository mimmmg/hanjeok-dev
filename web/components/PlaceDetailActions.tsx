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

/**
 * 상세 화면의 조작부 — 도보/차 토글과 근처 장소 보기.
 *
 * 둘을 한 컴포넌트에 둔 이유: 도보/차 상태를 링크가 함께 써야 한다.
 * 상태를 위로 끌어올리면 상세 화면 전체가 클라이언트 컴포넌트가 되어
 * 서버에서 하던 조회까지 브라우저로 내려간다.
 *
 * 담기는 여기 없다. 장소 이름 옆 하트(FavoriteHeart)가 맡는다 —
 * 상태 표시와 조작이 한 자리에 있는 편이 낫고, 버튼 하나가 줄어든다.
 */
export function PlaceDetailActions({
  placeId,
  placeName,
  currentPct,
}: {
  placeId: string
  placeName: string
  /** 현재 시간대 혼잡 지수. null 이면 예측치가 없다 */
  currentPct: number | null
}) {
  const [mode, setMode] = useState<TravelMode>('walk')

  /*
   * 근처 장소 버튼은 항상 둔다. 문구도 하나로 고정한다 —
   * 버튼 이름이 상황에 따라 바뀌면 처음 쓸 때 헷갈린다.
   *
   * PRD ⑤ 의 "혼잡 시 분기"는 강조의 차이로 지킨다. 붐빌 때는 진한 버튼과
   * 안내 문구까지 붙고, 여유로울 때는 선만 두른 약한 버튼이다.
   * 한적한데도 대안을 들이미는 건 방해지만, 근처에 뭐가 있는지 궁금한 건
   * 늘 유효한 질문이다.
   */
  const isCrowded =
    currentPct !== null && currentPct >= CONGESTION_THRESHOLDS.busy

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
            ? '걸어서 갈 수 있는 가까운 곳 위주로 찾습니다.'
            : '조금 멀어도 한적한 곳 위주로 찾습니다.'}
        </p>
      </div>

      <Link
        href={`/place/${placeId}/alternatives?mode=${mode}`}
        className={`font-display flex min-h-14 items-center justify-center gap-2 rounded-full px-5 text-base font-bold transition-colors ${
          isCrowded
            ? 'bg-ink text-screen hover:bg-[#132218]'
            : 'text-ink border border-[rgb(27_48_34_/_0.14)] hover:bg-[rgb(27_48_34_/_0.04)]'
        }`}
      >
        <Icon name="compare_arrows" size={20} />
        근처 가볼 만한 곳
      </Link>

      {isCrowded && (
        <p className="bg-calm-tint text-calm-fg flex items-start gap-2 rounded-xs border border-[rgb(170_166_72_/_0.34)] p-3 text-caption leading-relaxed">
          <Icon name="info" size={16} className="mt-px" />
          <span>
            지금 {placeName}은(는) 붐빕니다. 비슷한 분위기의 한적한 곳을 나란히
            비교해 보세요.
          </span>
        </p>
      )}
    </div>
  )
}
