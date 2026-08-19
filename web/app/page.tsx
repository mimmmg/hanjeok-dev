import { redirect } from 'next/navigation'

/**
 * 루트는 검색 진입으로 보낸다.
 *
 * 여기 있던 뼈대 진단 화면(Supabase·예측 서비스·익명 인증 확인)은 제 역할을
 * 다해 삭제했다. 그 셋은 이제 실제 화면에서 쓰이면서 검증된다 —
 * 검색이 되면 Supabase 가 붙은 것이고, 혼잡도 숫자가 나오면 예측 경로가
 * 살아 있는 것이며, 장소를 담을 수 있으면 익명 인증이 도는 것이다.
 *
 * PRD ⑤ 의 첫 화면인 랜딩(prototype/01-landing.html)은 아직 만들지 않았다.
 * 만들게 되면 이 자리를 차지하고 검색은 /search 로 남는다.
 */
export default function RootPage() {
  redirect('/search')
}
