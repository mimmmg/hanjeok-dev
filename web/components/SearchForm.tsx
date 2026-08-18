'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Icon } from '@/components/Icon'

/**
 * 검색 입력 폼. prototype/style.css 의 .search / .btn-terra 를 옮긴 것.
 *
 * 제출하면 결과 화면으로 이동한다. 검색어를 URL 쿼리에 담기 때문에
 * 새로고침·뒤로가기·링크 공유가 모두 자연스럽게 동작한다.
 */
export function SearchForm({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState(initialQuery)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search/results?q=${encodeURIComponent(q)}`)
  }

  return (
    <form onSubmit={handleSubmit} role="search" className="flex flex-col gap-3">
      <label className="bg-card border-line-3 flex min-h-14 cursor-text items-center gap-3 rounded-full border px-5">
        <Icon name="search" size={22} className="text-muted" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="장소 이름을 입력하세요"
          aria-label="관광지 이름 검색"
          autoComplete="off"
          className="text-ink placeholder:text-faint min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
        />
      </label>

      <button
        type="submit"
        disabled={!query.trim()}
        className="
          font-display bg-terra hover:bg-terra-link flex min-h-14 items-center
          justify-center gap-2 rounded-full px-5 text-base font-bold text-white
          transition-colors disabled:opacity-40
        "
      >
        혼잡도 보기
        <Icon name="arrow_forward" size={20} />
      </button>
    </form>
  )
}
