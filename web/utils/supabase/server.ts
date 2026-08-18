import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/types/database'

/**
 * 서버(서버 컴포넌트 / Route Handler / Server Action)에서 쓰는 Supabase 클라이언트.
 *
 * Next.js 16에서 cookies()는 async라 await가 필요하다.
 * 요청마다 새로 만들어야 한다 — 모듈 최상단에 만들어두고 재사용하면
 * 사용자 A의 세션이 사용자 B에게 새는 사고가 난다.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // 서버 컴포넌트에서는 쿠키를 쓸 수 없어 에러가 난다.
            // 세션 갱신은 proxy.ts가 담당하므로 여기서는 무시해도 안전하다.
          }
        },
      },
    },
  )
}
