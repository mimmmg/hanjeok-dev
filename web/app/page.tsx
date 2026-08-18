import { AnonAuthProbe } from '@/components/AnonAuthProbe'
import { fetchForecast } from '@/utils/predictor'
import { createClient } from '@/utils/supabase/server'

/**
 * [임시] 워킹 스켈레톤 진단 화면.
 *
 * 브라우저 → Next.js 서버 → Supabase / FastAPI 두 경로가 모두 뚫렸는지 확인한다.
 * 실제 검색 화면을 만들 때 이 파일은 통째로 대체된다.
 */
export default async function Home() {
  const supabase = await createClient()

  // ① Supabase — RLS "누구나 읽기" 정책이 동작하는지 함께 검증된다
  const { count, error } = await supabase
    .from('place')
    .select('*', { count: 'exact', head: true })

  // ② FastAPI — 서버에서만 호출한다. 실패해도 화면이 죽지 않아야 한다
  const forecast = await fetchForecast('skeleton-test')
  const peak = forecast?.slots.reduce((a, b) =>
    b.congestion_pct > a.congestion_pct ? b : a,
  )

  return (
    <main className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-xl font-bold">뼈대 진단</h1>

      <div className="rounded-lg border border-black/10 p-4">
        <h2 className="mb-2 text-sm font-semibold">① Supabase 연결 (서버)</h2>
        {error ? (
          <p className="text-sm text-red-600">❌ {error.message}</p>
        ) : (
          <p className="text-sm">
            ✅ place 테이블 조회 성공 — 현재 {count ?? 0}건
            <br />
            <span className="text-xs opacity-70">
              0건이 정상이다. KTO 시드는 아직 넣지 않았다.
            </span>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-black/10 p-4">
        <h2 className="mb-2 text-sm font-semibold">② FastAPI 예측 서비스 (서버 경유)</h2>
        {forecast && peak ? (
          <>
            <p className="text-sm">
              ✅ 예측치 {forecast.slots.length}개 시간대 수신
              <br />
              가장 붐비는 시간: <strong>{peak.hour_slot}시 · {peak.congestion_pct}%</strong>
            </p>
            <div className="mt-3 flex h-16 items-end gap-[2px]" aria-hidden>
              {forecast.slots.map((s) => (
                <div
                  key={s.hour_slot}
                  className="flex-1 rounded-t bg-black/70"
                  style={{ height: `${s.congestion_pct}%` }}
                />
              ))}
            </div>
            {forecast.is_mock && (
              <p className="mt-2 text-xs opacity-70">
                ⚠️ 더미 데이터다. 실제 KTO 데이터로 교체해야 한다.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-red-600">
            ❌ 예측 서비스 응답 없음
            <br />
            <span className="text-xs opacity-70">
              predictor가 떠 있는지 확인: cd predictor && ./.venv/bin/uvicorn app.main:app --port 8000
              <br />
              이 상태에서도 위 ①과 익명 인증은 정상 동작해야 한다 (PRD ⑦ 가용성 요구).
            </span>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-black/10 p-4">
        <h2 className="mb-2 text-sm font-semibold">③ 익명 인증 (브라우저)</h2>
        <AnonAuthProbe />
      </div>
    </main>
  )
}
