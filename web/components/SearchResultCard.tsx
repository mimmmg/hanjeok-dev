import Link from 'next/link'
import { CongestionGauge } from '@/components/CongestionGauge'
import { DistanceFromMe } from '@/components/DistanceFromMe'
import { Icon } from '@/components/Icon'
import type { Coords } from '@/hooks/useGeolocation'
import type { PlaceSearchResult } from '@/types/place'
import { CONGESTION_STYLE, congestionLevel } from '@/utils/congestionLevel'

/**
 * 검색 결과 한 줄. prototype/03-results.html 의 카드를 옮긴 것.
 *
 * 마크업을 프로토타입과 다르게 짠 곳이 하나 있다:
 * 프로토타입은 체크박스 <button> 을 카드 <a> 안에 넣었는데, 이는
 * 유효하지 않은 HTML 이다(대화형 요소 중첩). 클릭 대상이 겹쳐서
 * 체크하려다 상세로 넘어가는 사고도 난다.
 * 그래서 체크박스와 링크를 형제로 나란히 뒀다.
 */
export function SearchResultCard({
  place,
  selected,
  alreadySaved,
  onToggle,
  coords,
}: {
  place: PlaceSearchResult
  selected: boolean
  alreadySaved: boolean
  onToggle: () => void
  /** 목록에서 한 번만 받아 내려준 사용자 좌표. 없으면 거리 표시가 빠진다 */
  coords: Coords | null
}) {
  const pct = place.congestionPct
  const level = pct === null ? null : congestionLevel(pct)

  return (
    <div
      className={`bg-card flex items-center gap-3 rounded-lg border p-4 transition-colors ${
        selected ? 'border-terra' : 'border-line'
      }`}
    >
      {/* 체크박스 — 이미 담긴 장소는 비활성화해서 중복 담기를 화면에서 1차 차단 */}
      <button
        type="button"
        onClick={onToggle}
        disabled={alreadySaved}
        aria-pressed={selected}
        aria-label={
          alreadySaved
            ? `${place.name} 이미 담김`
            : `${place.name} 선택${selected ? ' 해제' : ''}`
        }
        className="flex size-tap flex-none items-center justify-center disabled:cursor-not-allowed"
      >
        <span
          className={`flex size-6 items-center justify-center rounded-[7px] border-2 transition-colors ${
            alreadySaved
              ? 'border-line-3 bg-sunk'
              : selected
                ? 'border-terra bg-terra'
                : 'border-[rgb(27_48_34_/_0.22)] bg-transparent'
          }`}
        >
          {(selected || alreadySaved) && (
            <Icon
              name="check"
              size={17}
              className={alreadySaved ? 'text-faint' : 'text-white'}
            />
          )}
        </span>
      </button>

      <Link href={`/place/${place.id}`} className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-ink truncate text-lead leading-tight font-semibold tracking-[-0.01em]">
            {place.name}
          </h2>
          {pct === null || level === null ? (
            <span className="text-faint flex-none text-caption">예측 없음</span>
          ) : (
            <span
              className={`font-display tabular flex-none text-lead leading-none font-bold ${CONGESTION_STYLE[level].fg}`}
              aria-label={`혼잡 지수 ${pct}`}
            >
              {pct}
            </span>
          )}
        </div>

        <p className="text-faint mt-[3px] text-caption">
          {[place.category, place.district].filter(Boolean).join(' · ') ||
            '서울'}
          {/* 위치 권한이 없으면 아무것도 그리지 않아 이 줄이 그대로 유지된다 */}
          <DistanceFromMe
            lat={place.lat}
            lng={place.lng}
            coords={coords}
            className="before:content-['_·_']"
          />
          {alreadySaved && <span className="text-terra-dark"> · 이미 담김</span>}
        </p>

        {pct !== null && (
          <div className="mt-2">
            <CongestionGauge pct={pct} showScale={false} />
          </div>
        )}
      </Link>
    </div>
  )
}
