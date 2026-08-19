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

const TABS: { href: string; icon: IconName; label: string; match: string }[] = [
  { href: '/search', icon: 'explore', label: '탐색', match: '/search' },
  {
    href: '/favorites',
    icon: 'favorite',
    label: '관심 장소함',
    match: '/favorites',
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
        // 검색 결과(/search/results)에서도 '탐색' 탭이 켜져 있어야 한다
        const active = pathname.startsWith(tab.match)
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={`font-display flex min-h-tap flex-1 flex-col items-center justify-center gap-[3px] text-micro font-semibold transition-colors ${
              active ? 'text-terra-link' : 'text-[#7A887C]'
            }`}
          >
            <Icon name={tab.icon} size={22} filled={active} />
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
