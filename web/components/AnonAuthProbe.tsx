'use client'

import { useState } from 'react'
import { ensureAnonymousUser } from '@/utils/supabase/ensureAnonymousUser'

/**
 * [임시] 익명 인증이 실제로 동작하는지 눈으로 확인하는 진단 컴포넌트.
 * 뼈대 검증용이며, 실제 화면을 만들 때 삭제한다.
 */
export function AnonAuthProbe() {
  const [uid, setUid] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      setUid(await ensureAnonymousUser())
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {loading ? '확인 중…' : '익명 인증 테스트'}
      </button>

      {uid && (
        <p className="mt-3 text-sm">
          ✅ 익명 uid 발급됨
          <br />
          <code className="text-xs break-all opacity-70">{uid}</code>
          <br />
          <span className="text-xs opacity-70">
            새로고침 후 다시 눌러도 같은 uid면 세션이 유지되는 것이다.
          </span>
        </p>
      )}

      {error && <p className="mt-3 text-sm text-red-600">❌ {error}</p>}
    </div>
  )
}
