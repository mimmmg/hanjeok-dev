import type { NextRequest } from 'next/server'
import { updateSession } from '@/utils/supabase/updateSession'

/**
 * Next.js 16에서 middleware.ts가 proxy.ts로 이름이 바뀌었다.
 * (Supabase 공식 문서는 아직 middleware 기준이니 그대로 복사하면 동작하지 않는다)
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 아래를 제외한 모든 경로에서 실행:
     * - _next/static, _next/image : 빌드 산출물
     * - favicon.ico, 이미지 파일   : 정적 자산
     * 정적 자산에까지 세션 갱신을 돌리면 Supabase 호출만 늘고 얻는 게 없다.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
