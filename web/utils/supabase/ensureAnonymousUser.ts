import { createClient } from '@/utils/supabase/client'

/**
 * 익명 사용자를 보장한다. 이미 세션이 있으면 그 uid를, 없으면 새로 발급받아 반환한다.
 *
 * PRD ⑦의 "가입 UI 없이 기기 내에서 uid 자동 유지" 요구사항을 담당한다.
 * 첫 방문마다 부르지 않고, 사용자가 처음 장소를 담을 때 호출한다 —
 * 방문만 하고 떠나는 트래픽까지 계정을 만들면 auth.users에 빈 계정이 쌓인다.
 *
 * 나중에 이메일 로그인을 붙이면 이 익명 계정을 승격(link)하는 방식으로 확장한다.
 */
export async function ensureAnonymousUser(): Promise<string> {
  const supabase = createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) return user.id

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    // Supabase 대시보드에서 Anonymous sign-ins가 꺼져 있으면 여기서 실패한다.
    throw new Error(`익명 인증 실패: ${error.message}`)
  }
  if (!data.user) {
    throw new Error('익명 인증은 성공했으나 user가 비어 있습니다.')
  }

  return data.user.id
}
