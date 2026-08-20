'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon } from '@/components/Icon'
import type { IconName } from '@/utils/icons'

/**
 * 하단 탭바. prototype/style.css 의 .tabbar / .tab 을 옮긴 것.
 *
 * 최상위 화면(탐색·검색결과·관심 장소함)에만 둔다. 상세와 대안 비교는
 * 뒤로가기로 빠져나오는 화면이라 프로토타입에도 탭바가 없다.
 * 깊이 들어간 화면에 탭바를 두면 "돌아가기"와 "이동하기"가 섞여
 * 지금 어디에 있는지 감이 흐려진다.
 */

/*
 * match 가 배열인 이유: 한 탭이 여러 경로를 대표한다.
 * 상세(/place/…)와 대안 비교는 탐색에서 들어오는 화면이라 '탐색'이 켜져
 * 있어야 한다. 안 그러면 상세로 들어가는 순간 탭바가 전부 꺼져
 * 고장 난 것처럼 보이고, 지금 어느 갈래에 있는지도 알 수 없다.
 */
const TABS: { href: string; icon: IconName; label: string; match: string[] }[] =
  [
    {
      href: '/search',
      icon: 'explore',
      label: '탐색',
      match: ['/search', '/place'],
    },
    {
      href: '/favorites',
      icon: 'favorite',
      label: '관심 장소함',
      match: ['/favorites'],
    },
  ]

export function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="주요 메뉴"
      className="bg-chrome border-line sticky bottom-0 z-20 flex flex-none border-t pt-2 pb-5 backdrop-blur-[14px]"
    >
      {TABS.map((tab) => {
        // 검색 결과(/search/results)·상세(/place/…)에서도 '탐색' 탭이 켜진다
        const active = tab.match.some((prefix) => pathname.startsWith(prefix))
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`font-display flex min-h-tap flex-1 flex-col items-center justify-center gap-1 text-micro transition-colors ${
              active
                ? 'text-terra-link font-bold'
                : 'font-semibold text-[#7A887C]'
            }`}
          >
            {/*
             * 활성 탭은 아이콘을 색칠된 알약 안에 넣는다. 색만 바꾸면
             * 22px 아이콘과 micro 라벨에서는 차이가 잘 안 보이고,
             * 색각 이상이 있으면 아예 구분되지 않는다. 배경 면적이
             * 생기면 색을 못 봐도 어느 쪽이 켜졌는지 알 수 있다.
             */}
            <span
              className={`flex h-7 w-14 items-center justify-center rounded-full transition-colors ${
                active ? 'bg-terra-tint' : ''
              }`}
            >
              <Icon name={tab.icon} size={22} filled={active} />
            </span>
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
