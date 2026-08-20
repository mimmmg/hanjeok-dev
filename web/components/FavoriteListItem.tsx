'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import { CongestionGauge } from '@/components/CongestionGauge'
import { CongestionSpark } from '@/components/CongestionSpark'
import { DistanceFromMe } from '@/components/DistanceFromMe'
import { Icon } from '@/components/Icon'
import type { Coords } from '@/hooks/useGeolocation'
import type { FavoritePlace } from '@/types/favorite'
import {
  CONGESTION_LABEL,
  CONGESTION_STYLE,
  congestionLevel,
} from '@/utils/congestionLevel'

/** 삭제 버튼이 드러나는 폭 */
const REVEAL_PX = 92
/** 이만큼 끌면 놓았을 때 열린 상태로 붙는다 */
const SNAP_THRESHOLD = 44
/** 가로/세로 의도를 가르는 최소 이동량 */
const DIRECTION_LOCK = 8

/**
 * 관심 장소함의 한 줄. 왼쪽으로 밀면 담기 해제 버튼이 나온다.
 *
 * 제스처를 직접 다루는 이유는 세로 스크롤과의 충돌 때문이다.
 * 손가락이 처음 어느 쪽으로 움직였는지 먼저 판별해서, 세로면 즉시 손을 떼
 * 브라우저 스크롤에 넘긴다. 이 판별이 없으면 목록을 스크롤하려다
 * 행이 따라 밀리는 화면이 된다.
 *
 * 밀기는 키보드로 할 수 없으므로, 삭제 버튼에 초점이 오면 자동으로 열리게 했다.
 * 탭 키만으로도 해제에 닿을 수 있어야 한다.
 */
export function FavoriteListItem({
  place,
  coords,
  onRemove,
  removing,
}: {
  place: FavoritePlace
  /**
   * 위에서 한 번 받은 사용자 좌표. 항목마다 위치를 따로 요청하면
   * 목록 길이만큼 권한 요청이 나간다.
   */
  coords: Coords | null
  onRemove: () => void
  removing: boolean
}) {
  const [offset, setOffset] = useState(0)
  const [dragging, setDragging] = useState(false)

  const start = useRef<{ x: number; y: number } | null>(null)
  const axis = useRef<'none' | 'x' | 'y'>('none')
  const openedAt = useRef(0)

  const pct = place.congestionPct
  const level = pct === null ? null : congestionLevel(pct)

  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    start.current = { x: e.clientX, y: e.clientY }
    axis.current = 'none'
    openedAt.current = offset
    setDragging(true)
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const dy = e.clientY - start.current.y

    // 아직 방향이 정해지지 않았으면 먼저 가른다
    if (axis.current === 'none') {
      if (Math.abs(dx) < DIRECTION_LOCK && Math.abs(dy) < DIRECTION_LOCK) return
      if (Math.abs(dy) > Math.abs(dx)) {
        // 세로 의도 — 스크롤은 브라우저에 맡기고 우리는 빠진다
        axis.current = 'y'
        start.current = null
        setDragging(false)
        return
      }
      axis.current = 'x'
      e.currentTarget.setPointerCapture(e.pointerId)
    }

    const next = Math.min(0, Math.max(-REVEAL_PX, openedAt.current + dx))
    setOffset(next)
  }

  function onPointerUp() {
    if (axis.current === 'x') {
      setOffset(offset < -SNAP_THRESHOLD ? -REVEAL_PX : 0)
    }
    start.current = null
    axis.current = 'none'
    setDragging(false)
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* 뒤에 깔린 삭제 버튼 */}
      <button
        type="button"
        onClick={onRemove}
        onFocus={() => setOffset(-REVEAL_PX)}
        onBlur={() => setOffset(0)}
        disabled={removing}
        aria-label={`${place.name} 담기 해제`}
        className="bg-busy absolute inset-y-0 right-0 flex w-[92px] flex-col items-center justify-center gap-1 text-white disabled:opacity-60"
      >
        <Icon
          name={removing ? 'progress_activity' : 'delete'}
          size={20}
          className={removing ? 'animate-spin' : ''}
        />
        <span className="font-display text-caption font-semibold">
          {removing ? '해제 중' : '담기 해제'}
        </span>
      </button>

      {/* 앞에서 밀리는 본체 */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? 'none' : 'transform 0.22s cubic-bezier(0.22,0.68,0,1)',
          touchAction: 'pan-y',
        }}
        className="bg-card border-line relative rounded-lg border p-4"
      >
        <div className="flex items-start justify-between gap-3">
          <Link
            href={`/place/${place.id}`}
            // 미는 동작이 끝난 직후의 클릭은 상세 진입이 아니다
            onClick={(e) => {
              if (offset !== 0) e.preventDefault()
            }}
            className="block min-w-0 flex-1"
          >
            <h3 className="font-display text-ink truncate text-lead leading-tight font-semibold tracking-[-0.01em]">
              {place.name}
            </h3>

            {/*
              거리와 역에서 도보 분. 프로토타입의 "5.1km · 버스 24분" 자리다.
              대중교통 소요시간은 목업 값이었고 실제로 받으려면 출발지 좌표를
              서버로 보내야 해서(위치정보 정책 변경) 붙이지 않았다. 대신 둘 다
              이미 있는 실데이터로 채운다 — 거리는 브라우저에서만 계산하고,
              역에서 도보는 KTO access_desc 에서 읽어 위치 권한이 필요 없다.
            */}
            <p className="text-faint mt-[5px] flex items-center gap-[5px] text-caption">
              <Icon name="near_me" size={15} className="flex-none" />
              <span className="truncate">
                <DistanceFromMe
                  lat={place.lat}
                  lng={place.lng}
                  coords={coords}
                  showLabel={false}
                />
                {place.transitMinutes !== null && (
                  <span className="before:content-['_·_'] first:before:content-none">
                    역에서 도보 {place.transitMinutes}분
                  </span>
                )}
              </span>
            </p>
          </Link>

          <div className="flex flex-none items-center gap-3">
            {pct === null || level === null ? (
              <span className="text-faint text-caption">예측 없음</span>
            ) : (
              <div className="text-right">
                <span
                  className={`font-display tabular block text-lead leading-none font-bold ${CONGESTION_STYLE[level].fg}`}
                  aria-label={`혼잡 지수 ${pct}`}
                >
                  {pct}
                </span>
                <span
                  className={`mt-[3px] block text-caption font-semibold ${CONGESTION_STYLE[level].fg}`}
                >
                  {CONGESTION_LABEL[level]}
                </span>
              </div>
            )}

            {/*
              하트로도 뺄 수 있게 한다. 밀기는 마우스로는 어색하고, 다른
              화면(검색 결과·상세·대안)이 모두 하트로 담고 빼므로 이 화면만
              제스처를 강요하면 조작 방식이 어긋난다. 밀기는 그대로 남는다.
            */}
            <button
              type="button"
              onClick={onRemove}
              disabled={removing}
              aria-label={`${place.name} 담기 해제`}
              className="text-terra-dark flex size-9 flex-none items-center justify-center rounded-full transition-colors hover:bg-[rgb(27_48_34_/_0.05)] disabled:opacity-50"
            >
              <Icon
                name={removing ? 'progress_activity' : 'favorite'}
                size={20}
                filled={!removing}
                className={removing ? 'animate-spin' : ''}
              />
            </button>
          </div>
        </div>

        {/* 하루 흐름 — "지금 붐빈다"에서 "이따 가면 되나"로 넘어가게 하는 부분 */}
        {place.slots.length > 0 ? (
          <div className="mt-3">
            <CongestionSpark slots={place.slots} peakHour={place.peakHour} />
            {place.peakHour !== null && (
              <p className="text-faint mt-2 text-caption">
                예상 피크 {place.peakHour}시
              </p>
            )}
          </div>
        ) : (
          pct !== null && (
            <div className="mt-3">
              <CongestionGauge pct={pct} showScale={false} />
            </div>
          )
        )}
      </div>
    </div>
  )
}
