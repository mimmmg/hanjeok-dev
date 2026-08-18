'use client'

import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { ensureAnonymousUser } from '@/utils/supabase/ensureAnonymousUser'

/**
 * [임시] 익명 인증이 실제로 동작하는지 눈으로 확인하는 진단 컴포넌트.
 * 뼈대 검증용이며, 실제 화면을 만들 때 삭제한다.
 *
 * 버튼은 prototype/style.css 의 .btn / .btn-terra 를 옮긴 것이다.
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

  const ok = Boolean(uid)

  return (
    <section className="bg-card border-line rounded-lg border p-4">
      <div className="mb-3 flex items-start gap-3">
        <span
          className={`font-display mt-px flex size-[22px] flex-none items-center justify-center rounded-full text-caption font-bold ${
            error ? 'bg-busy-tint text-busy-fg' : ok ? 'bg-calm text-white' : 'bg-sunk text-body'
          }`}
        >
          3
        </span>
        <h2 className="font-display text-lead flex-1 leading-tight font-semibold tracking-[-0.01em]">
          익명 인증
        </h2>
        {(ok || error) && (
          <Icon
            name={ok ? 'check_circle' : 'error'}
            size={20}
            filled
            className={ok ? 'text-calm' : 'text-busy'}
          />
        )}
      </div>

      {!uid && !error && (
        <p className="text-body mb-4 text-ui leading-relaxed">
          가입 없이 기기 안에서 유지되는 계정을 발급합니다. 관심 장소를 담을 때
          실제로 호출되는 경로입니다.
        </p>
      )}

      <button
        onClick={handleClick}
        disabled={loading}
        className="
          font-display bg-terra hover:bg-terra-link flex min-h-14 w-full
          items-center justify-center gap-2 rounded-full px-5 text-base
          font-bold text-white transition-colors disabled:opacity-50
        "
      >
        <Icon
          name={loading ? 'progress_activity' : 'fingerprint'}
          size={20}
          className={loading ? 'animate-spin' : ''}
        />
        {loading ? '확인 중…' : uid ? '다시 확인' : '익명 인증 테스트'}
      </button>

      {uid && (
        <div className="bg-calm-tint mt-4 rounded-xs border border-[rgb(170_166_72_/_0.34)] p-3">
          <p className="text-calm-fg font-display text-caption font-semibold tracking-[0.08em] uppercase">
            uid 발급됨
          </p>
          <code className="text-body mt-1.5 block font-mono text-micro break-all">
            {uid}
          </code>
          <p className="text-muted mt-2 text-caption leading-relaxed">
            새로고침 후 다시 눌러도 같은 값이면 세션이 유지되는 것입니다.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-busy-tint mt-4 rounded-xs border border-[rgb(223_109_65_/_0.3)] p-3">
          <p className="text-busy-fg text-ui leading-relaxed">{error}</p>
          <p className="text-muted mt-2 text-caption leading-relaxed">
            Supabase 대시보드에서 Anonymous sign-ins 가 켜져 있는지 확인하세요.
          </p>
        </div>
      )}
    </section>
  )
}
