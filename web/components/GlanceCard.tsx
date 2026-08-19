import Link from 'next/link'
import { CongestionGauge } from '@/components/CongestionGauge'
import { CongestionTag } from '@/components/CongestionTag'
import { Icon } from '@/components/Icon'
import type { FavoritePlace } from '@/types/favorite'
import { CONGESTION_STYLE, congestionLevel } from '@/utils/congestionLevel'

/**
 * 글랜스(하나씩 훑기) 모드의 카드 한 장.
 *
 * 리스트가 "어디를 담았더라"를 보는 화면이라면, 이쪽은 "지금 어디로 갈까"를
 * 고르는 화면이다. 그래서 혼잡 지수를 크게 키우고 경계선이 있는 게이지를
 * 함께 둬서 한 장만 봐도 판단이 서게 한다.
 */
export function GlanceCard({
  place,
  onRemove,
  removing,
}: {
  place: FavoritePlace
  onRemove: () => void
  removing: boolean
}) {
  const pct = place.congestionPct
  const level = pct === null ? null : congestionLevel(pct)

  return (
    <article className="bg-card border-line flex h-full flex-col rounded-lg border p-5">
      <p className="font-display text-muted text-caption font-semibold tracking-[0.08em] uppercase">
        {[place.category, place.district].filter(Boolean).join(' · ') || '서울'}
      </p>

      <Link
        href={`/place/${place.id}`}
        className="font-display text-ink mt-2 block text-title font-bold tracking-[-0.01em]"
      >
        {place.name}
      </Link>

      {pct === null || level === null ? (
        <p className="text-muted mt-4 text-ui">혼잡 예측치가 아직 없습니다.</p>
      ) : (
        <>
          <div className="mt-4 flex items-end gap-3">
            <span
              className={`font-display tabular text-hero leading-none font-extrabold tracking-[-0.03em] ${CONGESTION_STYLE[level].fg}`}
            >
              {pct}
            </span>
            <span className="mb-1.5">
              <CongestionTag pct={pct} showPct={false} />
            </span>
          </div>

          <div className="mt-4">
            <CongestionGauge pct={pct} />
          </div>
        </>
      )}

      <dl className="mt-5 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-faint flex-none text-caption">접근성</dt>
          <dd className="text-ink text-right text-label">
            {place.accessDesc ?? '정보 없음'}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="text-faint text-caption">입장료</dt>
          <dd className="text-ink text-label">{place.fee ?? '정보 없음'}</dd>
        </div>
      </dl>

      <div className="mt-auto flex gap-2 pt-5">
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="text-body hover:border-busy hover:text-busy-fg flex min-h-tap flex-none items-center gap-1.5 rounded-full border border-[rgb(27_48_34_/_0.14)] px-4 text-ui font-semibold transition-colors disabled:opacity-60"
        >
          <Icon
            name={removing ? 'progress_activity' : 'delete'}
            size={18}
            className={removing ? 'animate-spin' : ''}
          />
          {removing ? '해제 중' : '해제'}
        </button>

        <Link
          href={`/place/${place.id}`}
          className="font-display bg-terra hover:bg-terra-link flex min-h-tap flex-1 items-center justify-center rounded-full px-4 text-ui font-bold text-white transition-colors"
        >
          자세히 보기
        </Link>
      </div>
    </article>
  )
}
