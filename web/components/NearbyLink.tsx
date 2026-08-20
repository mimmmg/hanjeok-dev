import Link from 'next/link'
import { Icon } from '@/components/Icon'
import { CONGESTION_THRESHOLDS } from '@/utils/congestionLevel'

/**
 * 상세 화면에서 근처 장소 비교로 넘어가는 링크.
 *
 * 도보/차 토글은 여기 없다. 대안 비교 화면으로 옮겼다 — 후보가 여러 개
 * 있어야 기준을 바꿨을 때 순위가 달라지는 걸 볼 수 있고, 장소 하나뿐인
 * 상세 화면에서는 눌러도 화면이 변하지 않았다.
 *
 * 상태가 없어져서 클라이언트 컴포넌트일 이유도 없어졌다.
 * 서버에서 그대로 렌더된다.
 *
 * 문구는 하나로 고정한다 — 버튼 이름이 상황에 따라 바뀌면 처음 쓸 때 헷갈린다.
 * PRD ⑤ 의 "혼잡 시 분기"는 강조의 차이로 지킨다: 붐빌 때는 진한 버튼과
 * 안내 문구까지, 여유로울 때는 선만 두른 약한 버튼이다.
 */
export function NearbyLink({
  placeId,
  placeName,
  currentPct,
}: {
  placeId: string
  placeName: string
  /** 현재 시간대 혼잡 지수. null 이면 예측치가 없다 */
  currentPct: number | null
}) {
  const isCrowded =
    currentPct !== null && currentPct >= CONGESTION_THRESHOLDS.busy

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={`/place/${placeId}/alternatives`}
        className={`font-display flex min-h-14 items-center justify-center gap-2 rounded-full px-5 text-base font-bold transition-colors ${
          isCrowded
            ? 'bg-ink text-screen hover:bg-[#132218]'
            : 'text-ink border border-[rgb(27_48_34_/_0.14)] hover:bg-[rgb(27_48_34_/_0.04)]'
        }`}
      >
        <Icon name="compare_arrows" size={20} />
        근처 가볼 만한 곳
      </Link>

      {isCrowded && (
        <p className="bg-calm-tint text-calm-fg flex items-start gap-2 rounded-xs border border-[rgb(170_166_72_/_0.34)] p-3 text-caption leading-relaxed">
          <Icon name="info" size={16} className="mt-px" />
          <span>
            지금 {placeName}은(는) 붐빕니다. 비슷한 분위기의 한적한 곳을 나란히
            비교해 보세요.
          </span>
        </p>
      )}
    </div>
  )
}
