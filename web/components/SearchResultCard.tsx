import Link from 'next/link'
import { CongestionGauge } from '@/components/CongestionGauge'
import { DistanceFromMe } from '@/components/DistanceFromMe'
import { Icon } from '@/components/Icon'
import type { Coords } from '@/hooks/useGeolocation'
import type { PlaceSearchResult } from '@/types/place'
import {
  CONGESTION_LABEL,
  CONGESTION_STYLE,
  congestionLevel,
} from '@/utils/congestionLevel'

/**
 * 검색 결과 한 줄. prototype/03-results.html 의 카드를 옮긴 것.
 *
 * 프로토타입과 다른 점 두 가지:
 *
 * 1. 체크박스 대신 하트 버튼이다. 프로토타입은 여러 곳을 고른 뒤 하단
 *    버튼으로 한 번에 담는 방식이었는데, 세어 보면 N곳 담을 때 체크박스는
 *    N+1 탭이고 하트는 N 탭이다. 연달아 누르면 다건 등록도 그대로 된다.
 *
 * 2. 혼잡 지수 옆에 등급(여유·보통·혼잡)을 함께 적는다. 숫자만 있으면
 *    25 가 좋은 건지 나쁜 건지 알 수 없다. 게이지의 45/70 눈금이 근거를
 *    보여주지만, 한 단어로 먼저 읽히는 편이 빠르다.
 */
export function SearchResultCard({
  place,
  saved,
  saving,
  onToggleSave,
  coords,
}: {
  place: PlaceSearchResult
  saved: boolean
  saving: boolean
  onToggleSave: () => void
  /** 목록에서 한 번만 받아 내려준 사용자 좌표. 없으면 거리 표시가 빠진다 */
  coords: Coords | null
}) {
  const pct = place.congestionPct
  const level = pct === null ? null : congestionLevel(pct)

  return (
    <div className="bg-card border-line flex items-center gap-3 rounded-lg border p-4">
      <Link href={`/place/${place.id}`} className="min-w-0 flex-1">
        <h2 className="font-display text-ink truncate text-lead leading-tight font-semibold tracking-[-0.01em]">
          {place.name}
        </h2>

        <p className="text-faint mt-[3px] text-caption">
          {[place.category, place.district].filter(Boolean).join(' · ') || '서울'}
          <DistanceFromMe
            lat={place.lat}
            lng={place.lng}
            coords={coords}
            className="before:content-['_·_']"
          />
        </p>

        {pct !== null && (
          <div className="mt-2">
            <CongestionGauge pct={pct} showScale={false} />
          </div>
        )}
      </Link>

      {/* 혼잡 지수 + 등급 */}
      <div className="flex-none text-right">
        {pct === null || level === null ? (
          <span className="text-faint text-caption">예측 없음</span>
        ) : (
          <>
            <span
              className={`font-display tabular block text-title leading-none font-bold ${CONGESTION_STYLE[level].fg}`}
              aria-label={`혼잡 지수 ${pct}`}
            >
              {pct}
            </span>
            <span
              className={`mt-1 block text-caption font-semibold ${CONGESTION_STYLE[level].fg}`}
            >
              {CONGESTION_LABEL[level]}
            </span>
          </>
        )}
      </div>

      {/* 하트 — 누르면 바로 담기고, 다시 누르면 빠진다 */}
      <button
        type="button"
        onClick={onToggleSave}
        disabled={saving}
        aria-pressed={saved}
        aria-label={`${place.name} ${saved ? '관심 장소에서 빼기' : '관심 장소에 담기'}`}
        className="flex size-tap flex-none items-center justify-center rounded-full transition-colors hover:bg-[rgb(27_48_34_/_0.05)] disabled:opacity-50"
      >
        <Icon
          name={saving ? 'progress_activity' : 'favorite'}
          size={24}
          filled={saved}
          className={
            saving
              ? 'text-muted animate-spin'
              : saved
                ? 'text-terra'
                : 'text-faint'
          }
        />
      </button>
    </div>
  )
}
