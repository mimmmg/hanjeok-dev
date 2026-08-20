import Link from 'next/link'
import { CongestionGauge } from '@/components/CongestionGauge'
import { FavoriteHeart } from '@/components/FavoriteHeart'
import { Icon } from '@/components/Icon'
import type { TravelMode } from '@/types/travel'
import { TRAVEL_MODE_LABEL } from '@/types/travel'
import type { ScoreBreakdown } from '@/utils/alternativeScore'
import { SCORE_WEIGHTS } from '@/utils/alternativeScore'
import {
  CONGESTION_LABEL,
  CONGESTION_STYLE,
  congestionLevel,
} from '@/utils/congestionLevel'
import { formatDistance } from '@/utils/distance'

export type Alternative = {
  id: string
  name: string
  category: string | null
  congestionPct: number | null
  distanceKm: number
  score: ScoreBreakdown
  /** 이미 관심 장소함에 있는지 */
  saved: boolean
}

/**
 * 대안 후보 카드 (PRD ⑤ "대안 비교", Must ③④).
 *
 * 페인포인트 "단일 추천은 못 믿는다"에 대응하는 화면이라, 순위만 주지 않고
 * 판단 근거(혼잡·접근성·날씨·거리)를 나란히 펼쳐 보여준다. 사용자가
 * 추천을 검산할 수 있어야 안심으로 이어진다는 게 저니맵에서 확인된 지점이다.
 */
export function AlternativeCard({
  alternative: alt,
  rank,
  mode,
  baseName,
  basePct,
}: {
  alternative: Alternative
  rank: number
  mode: TravelMode
  baseName: string
  basePct: number | null
}) {
  const isBest = rank === 1
  const level = alt.congestionPct === null ? null : congestionLevel(alt.congestionPct)
  const diff =
    basePct !== null && alt.congestionPct !== null
      ? basePct - alt.congestionPct
      : null

  return (
    <article
      className={`bg-card overflow-hidden rounded-lg border ${
        isBest ? 'border-calm' : 'border-line'
      }`}
    >
      {/* 순위 머리 — 1순위만 올리브 배경으로 눈에 띄게 */}
      <div
        className={`flex items-center gap-2 py-1 pr-2 pl-4 ${
          isBest ? 'bg-[rgb(170_166_72_/_0.14)]' : 'border-line border-b'
        }`}
      >
        <span
          className={`font-display flex size-[22px] flex-none items-center justify-center rounded-full text-caption font-bold ${
            isBest ? 'bg-calm text-white' : 'bg-[rgb(27_48_34_/_0.07)] text-body'
          }`}
        >
          {rank}
        </span>
        <span
          className={`text-caption ${isBest ? 'text-calm-fg font-semibold' : 'text-faint'}`}
        >
          {isBest
            ? `1순위 추천 · ${TRAVEL_MODE_LABEL[mode]} 기준`
            : `${rank}순위`}
        </span>
        <span className="font-display tabular text-faint ml-auto text-caption">
          {alt.score.total}점
        </span>

        {/*
          비교하다 마음에 들면 그 자리에서 담을 수 있어야 한다.
          순위 머리 오른쪽에 두면 이름·혼잡 지수 줄을 건드리지 않고,
          다른 화면(검색 결과·상세)처럼 "카드 오른쪽 끝의 하트"로 일관된다.
        */}
        <FavoriteHeart
          placeId={alt.id}
          placeName={alt.name}
          initialSaved={alt.saved}
          size={20}
        />
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/place/${alt.id}`}
              className="font-display text-ink block truncate text-lead leading-tight font-semibold tracking-[-0.01em]"
            >
              {alt.name}
            </Link>
            <p className="text-faint mt-1 text-caption">{alt.category ?? '관광지'}</p>
          </div>

          {alt.congestionPct !== null && level !== null ? (
            <div className="flex-none text-right">
              <span
                className={`font-display tabular text-lead leading-none font-bold ${CONGESTION_STYLE[level].fg}`}
              >
                {alt.congestionPct}
              </span>
              <span
                className={`mt-[3px] block text-caption font-semibold ${CONGESTION_STYLE[level].fg}`}
              >
                {CONGESTION_LABEL[level]}
              </span>
            </div>
          ) : (
            <span className="text-faint flex-none text-caption">예측 없음</span>
          )}
        </div>

        {alt.congestionPct !== null && (
          <div className="mt-3">
            <CongestionGauge pct={alt.congestionPct} showScale={false} />
          </div>
        )}

        {/*
          기본정보(날씨·접근성·입장료)는 상세 화면에만 둔다.
          카드마다 네 줄씩 붙으면 다섯 곳을 견주기 어렵다 — 비교 화면은
          "무엇이 다른가"만 보여야 한다. 거리는 이동 부담을 가르는 값이라 남긴다.
        */}
        <p className="text-faint mt-3 text-caption">
          {formatDistance(alt.distanceKm)}
          {alt.score.transitMinutes !== null &&
            ` · 역에서 도보 ${alt.score.transitMinutes}분`}
        </p>

        {/* 왜 이 점수인지 — 추천을 검산할 수 있게 */}
        <p className="text-faint border-line mt-3 border-t pt-3 text-micro leading-relaxed">
          혼잡 {alt.score.congestionScore} × {SCORE_WEIGHTS.congestion} + 접근성{' '}
          {alt.score.accessScore} × {SCORE_WEIGHTS.access} ={' '}
          <strong className="text-body">{alt.score.total}점</strong>
        </p>

        {diff !== null && diff > 0 && (
          <p className="text-calm-fg mt-3 flex items-center gap-1.5 text-caption font-semibold">
            <Icon name="trending_down" size={17} />
            {baseName}보다 혼잡 지수 {diff} 낮음 ·{' '}
            {formatDistance(alt.distanceKm)}
          </p>
        )}

        <Link
          href={`/place/${alt.id}`}
          className={`font-display mt-4 flex min-h-tap items-center justify-center rounded-full px-4 text-ui font-bold transition-colors ${
            isBest
              ? 'bg-terra hover:bg-terra-link text-white'
              : 'text-ink border border-[rgb(27_48_34_/_0.14)] hover:bg-[rgb(27_48_34_/_0.04)]'
          }`}
        >
          이 대안 자세히 보기
        </Link>
      </div>
    </article>
  )
}
