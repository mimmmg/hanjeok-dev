import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { TRAVEL_MODE_LABEL, TRAVEL_MODES, type TravelMode } from '@/types/travel'

/**
 * 도보 / 차 토글 (PRD ④ Should — 이동수단 기반 판단 지원).
 *
 * 모양은 prototype/style.css 의 .travel / .travel-opt 를 옮긴 것이다.
 * 알약형 .segbar(관심 장소함의 목록↔훑기)와 다르다 — 이쪽은 사각에 가까운
 * 둥근 모서리, 카드 배경, 내용만큼만 차지하는 인라인 폭이다.
 * 화면의 주된 조작이 아니라 옆에 붙는 기준 선택이라 작게 둔다.
 *
 * 대안 비교 화면에 둔다. 후보가 여러 개 있어야 순위가 바뀌는 걸 볼 수 있어서,
 * 장소 하나만 있는 상세 화면에서는 눌러도 화면이 변하지 않았다.
 *
 * 클라이언트 컴포넌트가 아니라 링크 두 개다. 서버가 새 순위로 다시 그리므로
 * JS 없이도 동작하고, 주소에 기준이 남아 그대로 공유·새로고침이 된다.
 */
export function TravelModeToggle({
  current,
  basePath,
}: {
  current: TravelMode
  /** 쿼리를 붙일 경로. 예: /place/{id}/alternatives */
  basePath: string
}) {
  return (
    <div
      role="group"
      aria-label="이동수단 기준"
      className="bg-card inline-flex flex-none rounded-xs p-1 shadow-[0_2px_10px_rgb(27_48_34_/_0.05)]"
    >
      {TRAVEL_MODES.map((mode) => {
        const active = mode === current
        return (
          <Link
            key={mode}
            href={`${basePath}?mode=${mode}`}
            // 순위만 바뀌므로 스크롤을 맨 위로 되돌리지 않는다
            scroll={false}
            aria-current={active ? 'true' : undefined}
            className={`font-display flex items-center gap-1 rounded-[9px] px-2.5 py-1.5 text-caption font-semibold transition-colors ${
              active ? 'bg-terra text-white' : 'text-body'
            }`}
          >
            <Icon
              name={mode === 'walk' ? 'directions_walk' : 'directions_car'}
              size={15}
            />
            {TRAVEL_MODE_LABEL[mode]}
          </Link>
        )
      })}
    </div>
  )
}
