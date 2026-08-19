import type { Metadata } from 'next'
import { DeviceFrame } from '@/components/DeviceFrame'
import { SearchForm } from '@/components/SearchForm'

export const metadata: Metadata = {
  title: '탐색 — 한적',
}

/**
 * 검색 진입 화면 (PRD ⑤ "검색 진입").
 *
 * 텍스트 입력과 검색 버튼만 둔다. 이 시점에는 어떤 데이터도 조회하지 않아
 * 첫 화면의 로딩 부담이 없다 — PRD 가 이 화면을 "최소 진입점"으로 규정한 이유다.
 * MVP 는 서울 한정이라 지역 선택 UI 는 두지 않는다.
 *
 * 데이터 조회가 없으므로 정적으로 미리 생성된다.
 */
export default function SearchPage() {
  return (
    <DeviceFrame title="탐색">
      <div className="px-6 pt-6">
        <div className="zin">
          <h2 className="font-display text-[26px] leading-[1.25] font-bold tracking-[-0.02em]">
            어디로 떠나고 싶으세요?
          </h2>
          <p className="text-muted mt-2 text-label">
            장소를 입력하면 지금 혼잡도부터 보여드려요.
          </p>
        </div>

        <div className="zin mt-5 [animation-delay:0.06s]">
          <SearchForm />
        </div>
      </div>
    </DeviceFrame>
  )
}
