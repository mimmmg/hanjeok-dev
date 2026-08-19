import Link from 'next/link'
import type { ReactNode } from 'react'
import { Icon } from '@/components/Icon'
import { TabBar } from '@/components/TabBar'

/**
 * 430 × 880 모바일 앱 화면 프레임. prototype/style.css 의 .device 를 옮긴 것.
 *
 * 데스크톱에서는 연한 그린 바탕 위에 화면을 띄우고, 470px 이하에서는
 * 프레임을 풀어 실제 모바일 화면을 꽉 채운다.
 *
 * 하단 탭바는 모든 화면에 고정으로 둔다. 프로토타입은 상세·대안에서
 * 탭바를 뺐지만, 깊이 들어간 화면에서도 탐색·관심 장소함으로 바로 갈 수
 * 있는 편이 낫다는 판단이다. 뒤로가기는 상단 화살표가 맡는다.
 * (데스크톱 전용 2컬럼 레이아웃은 별도 설계 예정 — PROGRESS.md 참고)
 */
export function DeviceFrame({
  title,
  backHref,
  children,
}: {
  title?: string
  /** 넘기면 상단에 뒤로가기 버튼이 생긴다 */
  backHref?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-center px-4 pt-7 pb-12 max-[470px]:p-0">
      <div
        className="
          bg-screen relative flex w-[430px] max-w-full flex-none flex-col
          overflow-hidden rounded-device shadow-[0_18px_60px_rgb(27_48_34_/_0.14)]
          min-h-[880px]
          max-[470px]:min-h-dvh max-[470px]:w-full max-[470px]:rounded-none
          max-[470px]:shadow-none
        "
      >
        {title && (
          <header
            className="
              bg-chrome border-line sticky top-0 z-20 flex h-15 flex-none
              items-center gap-2 border-b pr-3 pl-2 backdrop-blur-[14px]
            "
          >
            {backHref ? (
              <Link
                href={backHref}
                aria-label="뒤로"
                className="text-ink flex size-tap flex-none items-center justify-center rounded-full transition-colors hover:bg-[rgb(27_48_34_/_0.05)]"
              >
                <Icon name="arrow_back" size={22} />
              </Link>
            ) : (
              <span className="w-2 flex-none" />
            )}
            <h1 className="font-display flex-1 pl-2 text-title font-bold tracking-[-0.01em]">
              {title}
            </h1>
          </header>
        )}

        <div className="flex-1 overflow-y-auto overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {children}
        </div>

        <TabBar />
      </div>
    </div>
  )
}
