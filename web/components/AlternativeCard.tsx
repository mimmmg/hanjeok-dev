import Link from 'next/link'
import { CongestionGauge } from '@/components/CongestionGauge'
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
  accessDesc: string | null
  fee: string | null
  congestionPct: number | null
  distanceKm: number
  score: ScoreBreakdown
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
        className={`flex items-center gap-2 px-4 py-3 ${
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

        {/* 판단 근거를 나란히 — 이 화면의 존재 이유 */}
        <dl className="mt-4 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <dt className="text-faint text-caption">이동</dt>
            <dd className="text-ink text-label">
              {formatDistance(alt.distanceKm)}
              {alt.score.transitMinutes !== null &&
                ` · 역에서 도보 ${alt.score.transitMinutes}분`}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-faint text-caption">날씨</dt>
            <dd className="text-muted flex items-center gap-1 text-label">
              <Icon name="wb_sunny" size={15} />
              연동 예정
            </dd>
          </div>
          <div className="flex items-start justify-between gap-3">
            <dt className="text-faint flex-none text-caption">접근성</dt>
            <dd className="text-ink text-right text-label">
              {alt.accessDesc ?? '정보 없음'}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="text-faint text-caption">입장료</dt>
            <dd className="text-ink text-label">{alt.fee ?? '정보 없음'}</dd>
          </div>
        </dl>

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
