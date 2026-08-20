import Link from 'next/link'
import { CONGESTION_LABEL, CONGESTION_STYLE, congestionLevel } from '@/utils/congestionLevel'

export type SuggestPlace = {
  id: string
  name: string
  /** 현재 시간대 혼잡 지수. null 이면 점을 회색으로 둔다 */
  congestionPct: number | null
}

/**
 * 검색 진입 화면의 추천 칩. prototype/style.css 의 .suggest / .dot 을 옮긴 것.
 *
 * 이름 앞에 혼잡도 색 점을 붙이는 게 핵심이다. 검색을 하기 전에 이미
 * "경복궁은 붐비고 서울숲은 여유롭다"가 보인다 — PRD ② 의 결론
 * ("혼잡도를 고려하는 습관이 없으니 기존 흐름 안에 끼어들어야 한다")이
 * 이 자리에서 성립한다.
 *
 * 칩을 누르면 검색 결과가 아니라 그 장소의 상세로 바로 간다.
 * 어느 장소인지 이미 아는 상태라 결과 목록을 한 번 더 거칠 이유가 없다.
 */
export function SuggestChips({ places }: { places: SuggestPlace[] }) {
  if (places.length === 0) return null

  return (
    <section>
      <h3 className="font-display text-muted text-caption font-semibold tracking-[0.08em] uppercase">
        지금 서울에서 많이 찾는 곳
      </h3>

      <ul className="mt-3 flex flex-wrap gap-2">
        {places.map((place) => {
          const level =
            place.congestionPct === null
              ? null
              : congestionLevel(place.congestionPct)
          return (
            <li key={place.id}>
              <Link
                href={`/place/${place.id}`}
                className="bg-card border-line-3 text-ink hover:border-muted flex min-h-tap items-center gap-2 rounded-full border px-4 text-ui font-medium transition-colors"
              >
                <span
                  aria-hidden
                  className={`size-[7px] flex-none rounded-full ${
                    level ? CONGESTION_STYLE[level].fill : 'bg-line-2'
                  }`}
                />
                {place.name}
                {level && (
                  <span className="sr-only">
                    {' '}
                    현재 {CONGESTION_LABEL[level]}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
