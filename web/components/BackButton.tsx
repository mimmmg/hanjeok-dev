'use client'

import { useRouter } from 'next/navigation'
import { Icon } from '@/components/Icon'

/**
 * 뒤로가기.
 *
 * 고정 경로가 아니라 브라우저 히스토리를 되짚는다. 상세 화면은 검색 결과,
 * 관심 장소함, 대안 카드 등 여러 곳에서 들어오는데 링크를 /search 로
 * 박아두면 관심 장소함에서 들어온 사람이 검색 화면으로 튕겨 나간다.
 *
 * 히스토리가 없을 때(주소를 직접 열었거나 새 탭으로 열린 경우)를 대비해
 * fallback 경로를 받는다. router.back() 만 부르면 그런 경우에 아무 일도
 * 일어나지 않아 버튼이 고장 난 것처럼 보인다.
 */
export function BackButton({ fallbackHref }: { fallbackHref: string }) {
  const router = useRouter()

  function handleClick() {
    // 이 앱 안에서 넘어온 흔적이 있으면 히스토리를 되짚는다.
    // history.length 는 새 탭에서 1 이고, 같은 탭에서 이동했으면 2 이상이다.
    if (window.history.length > 1) {
      router.back()
      return
    }
    router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="뒤로"
      className="text-ink flex size-tap flex-none items-center justify-center rounded-full transition-colors hover:bg-[rgb(27_48_34_/_0.05)]"
    >
      <Icon name="arrow_back" size={22} />
    </button>
  )
}
