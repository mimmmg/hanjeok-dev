import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 요청마다 Supabase 세션 토큰을 갱신하고, 갱신된 쿠키를 응답에 실어 보낸다.
 * proxy.ts(구 middleware.ts)에서 호출한다.
 *
 * 이게 없으면 익명 세션 토큰이 만료된 뒤 즐겨찾기가 조용히 실패한다.
 * 여기서는 "갱신"만 하고, 익명 계정 발급은 하지 않는다 —
 * 발급까지 여기서 하면 크롤러·봇이 방문할 때마다 빈 계정이 쌓인다.
 * 실제 발급은 사용자가 처음 장소를 담을 때 ensureAnonymousUser()가 한다.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value)
          })
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    },
  )

  // getUser()를 호출해야 만료 임박 토큰이 갱신된다. 반환값은 쓰지 않는다.
  await supabase.auth.getUser()

  return supabaseResponse
}
