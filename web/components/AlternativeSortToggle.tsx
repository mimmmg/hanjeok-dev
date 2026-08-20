import Link from 'next/link'
import { Icon } from '@/components/Icon'
import {
  ALTERNATIVE_SORT_LABEL,
  ALTERNATIVE_SORTS,
  type AlternativeSort,
} from '@/types/alternativeSort'
import type { IconName } from '@/utils/icons'
import type { TravelMode } from '@/types/travel'

/**
 * 대안 목록 정렬 토글.
 *
 * 모양은 prototype/style.css 의 .segbar / .seg 를 옮긴 것이다.
 * 도보/차 토글(.travel)과 일부러 다르게 생겼다 — 그쪽은 헤더에 붙는 작은
 * 인라인 알약이고, 이쪽은 리스트 폭을 꽉 채운 세그먼트다.
 *
 * 생김새와 자리를 나눈 이유: 두 토글이 하는 일이 다르다.
 * 도보/차는 **후보 범위**를 바꾸고(목록 구성이 달라진다), 정렬은 **순서**만
 * 바꾼다(구성은 그대로). 나란히 붙여 두면 조합 네 가지가 한 덩어리로 보여
 * "지금 뭘 보고 있는지"가 흐려진다. 각자 지배하는 대상 옆에 두면
 * 설명이 필요 없어진다 — 정렬은 리스트 바로 위에 붙는다.
 *
 * TravelModeToggle 과 같이 클라이언트 컴포넌트가 아니라 링크 두 개다.
 * 서버가 새 순서로 다시 그리므로 JS 없이도 동작하고, 주소에 기준이 남아
 * 그대로 공유·새로고침이 된다.
 */

const SORT_ICON: Record<AlternativeSort, IconName> = {
  calm: 'trending_down',
  near: 'near_me',
}

export function AlternativeSortToggle({
  current,
  mode,
  basePath,
}: {
  current: AlternativeSort
  /** 이동수단은 정렬을 바꿀 때도 유지돼야 한다 */
  mode: TravelMode
  /** 쿼리를 붙일 경로. 예: /place/{id}/alternatives */
  basePath: string
}) {
  return (
    <div
      role="group"
      aria-label="정렬 기준"
      className="bg-sunk flex gap-1 rounded-full p-1"
    >
      {ALTERNATIVE_SORTS.map((sort) => {
        const active = sort === current
        return (
          <Link
            key={sort}
            href={`${basePath}?mode=${mode}&sort=${sort}`}
            // 순서만 바뀌므로 스크롤을 맨 위로 되돌리지 않는다
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={`font-display flex min-h-[38px] flex-1 items-center justify-center gap-1.5 rounded-full text-label font-semibold transition-colors ${
              active
                ? 'bg-terra text-white'
                : 'text-body hover:bg-[rgb(255_255_255_/_0.6)]'
            }`}
          >
            <Icon name={SORT_ICON[sort]} size={18} />
            {ALTERNATIVE_SORT_LABEL[sort]}
          </Link>
        )
      })}
    </div>
  )
}
