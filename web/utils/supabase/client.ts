import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

/**
 * 브라우저(클라이언트 컴포넌트)에서 쓰는 Supabase 클라이언트.
 *
 * 세션을 localStorage가 아니라 쿠키에 저장하기 때문에, 서버 컴포넌트에서도
 * 같은 로그인 상태를 읽을 수 있다. (utils/supabase/server.ts 와 짝)
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  )
}
