import type { IconName } from '@/utils/icons'

/**
 * Material Symbols 아이콘.
 *
 * name 이 IconName 으로 묶여 있어, utils/icons.ts 의 목록에 없는 아이콘을
 * 쓰면 TypeScript 가 빌드 전에 잡는다 (서브셋에 없으면 글자로 보이는 문제 방지).
 *
 * 기본적으로 aria-hidden 이다 — 아이콘 옆에 항상 글자 설명이 함께 있기 때문에
 * 스크린리더가 아이콘 이름("check_circle")까지 읽으면 오히려 방해가 된다.
 */
export function Icon({
  name,
  size = 24,
  filled = false,
  className = '',
}: {
  name: IconName
  size?: number
  filled?: boolean
  className?: string
}) {
  return (
    <span
      className={`ms ${filled ? 'ms-fill' : ''} ${className}`}
      style={{ fontSize: size }}
      aria-hidden
    >
      {name}
    </span>
  )
}
