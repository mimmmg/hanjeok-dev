import Link from 'next/link'
import { CongestionGauge } from '@/components/CongestionGauge'
import { FavoriteHeart } from '@/components/FavoriteHeart'
import { Icon } from '@/components/Icon'
import {
  ALTERNATIVE_SORT_TOP_LABEL,
  type AlternativeSort,
} from '@/types/alternativeSort'
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
  /** access_desc 에서 읽어낸 역에서 도보 분. 못 읽으면 null */
  transitMinutes: number | null
  /** 이미 관심 장소함에 있는지 */
  saved: boolean
}

/**
 * 대안 후보 카드 (PRD ⑤ "대안 비교", Must ③④).
 *
 * 페인포인트 "단일 추천은 못 믿는다"에 대응하는 화면이라, 순위만 주지 않고
 * 판단 근거를 나란히 펼쳐 보여준다.
 *
 * 다만 **가중합 점수는 여기 오지 않는다.** 화면에 남는 숫자는 혼잡 지수와
 * 거리뿐이고, 둘 다 정렬 기준과 맞물려 있어 사용자가 순서를 눈으로 검산할
 * 수 있다. 점수를 띄우면 "왜 68점인가"라는, 확인할 방법이 없는 질문이
 * 하나 더 생긴다. 점수는 후보 다섯 곳을 고르는 데만 쓰고 감춘다
 * (`utils/alternativeScore.ts`).
 *
 * 그래서 1순위 머리도 "1순위 추천"이 아니라 정렬 기준을 그대로 적는다 —
 * 지금 보이는 순서는 우리가 추천한 게 아니라 사용자가 고른 기준이다.
 */
export function AlternativeCard({
  alternative: alt,
  rank,
  sort,
  baseName,
  basePct,
}: {
  alternative: Alternative
  rank: number
  sort: AlternativeSort
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
          {isBest ? ALTERNATIVE_SORT_TOP_LABEL[sort] : `${rank}순위`}
        </span>

        {/*
          비교하다 마음에 들면 그 자리에서 담을 수 있어야 한다.
          순위 머리 오른쪽에 두면 이름·혼잡 지수 줄을 건드리지 않고,
          다른 화면(검색 결과·상세)처럼 "카드 오른쪽 끝의 하트"로 일관된다.
          점수 배지가 있던 자리라 ml-auto 로 직접 오른쪽 끝에 붙인다.
        */}
        <span className="ml-auto flex flex-none">
          <FavoriteHeart
            placeId={alt.id}
            placeName={alt.name}
            initialSaved={alt.saved}
            size={20}
          />
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

        {/*
          기본정보(날씨·접근성·입장료)는 상세 화면에만 둔다.
          카드마다 네 줄씩 붙으면 다섯 곳을 견주기 어렵다 — 비교 화면은
          "무엇이 다른가"만 보여야 한다. 거리는 이동 부담을 가르는 값이라 남긴다.
        */}
        <p className="text-faint mt-3 text-caption">
          {formatDistance(alt.distanceKm)}
          {alt.transitMinutes !== null &&
            ` · 역에서 도보 ${alt.transitMinutes}분`}
        </p>

        {/*
          기준 장소와의 차이. 거리는 위 줄에 이미 있으니 반복하지 않는다 —
          같은 값이 두 줄에 겹쳐 나오면 다른 값인가 싶어 한 번 더 읽게 된다.
        */}
        {diff !== null && diff > 0 && (
          <p className="text-calm-fg mt-3 flex items-center gap-1.5 text-caption font-semibold">
            <Icon name="trending_down" size={17} />
            {baseName}보다 혼잡 지수 {diff} 낮음
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
