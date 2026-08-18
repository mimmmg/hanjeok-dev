import type { ReactNode } from 'react'
import { AnonAuthProbe } from '@/components/AnonAuthProbe'
import { CongestionGauge } from '@/components/CongestionGauge'
import { CongestionTag } from '@/components/CongestionTag'
import { DeviceFrame } from '@/components/DeviceFrame'
import { HoursChart } from '@/components/HoursChart'
import { Icon } from '@/components/Icon'
import { fetchForecast } from '@/utils/predictor'
import { createClient } from '@/utils/supabase/server'

/**
 * [임시] 워킹 스켈레톤 진단 화면.
 *
 * 브라우저 → Next.js 서버 → Supabase / FastAPI 두 경로가 뚫렸는지 확인한다.
 * 실제 검색 화면을 만들 때 이 파일은 통째로 대체된다.
 *
 * 디자인은 prototype/ 의 시스템을 그대로 쓴다. 진단 화면이라도 토큰과
 * 컴포넌트를 실제로 태워봐야 이식이 제대로 됐는지 알 수 있다.
 */

/** [임시] 진단 항목 카드. 이 페이지와 함께 삭제된다. */
function StatusCard({
  step,
  title,
  ok,
  children,
}: {
  step: string
  title: string
  ok: boolean
  children: ReactNode
}) {
  return (
    <section className="bg-card border-line rounded-lg border p-4">
      <div className="mb-3 flex items-start gap-3">
        <span
          className={`font-display mt-px flex size-[22px] flex-none items-center justify-center rounded-full text-caption font-bold ${
            ok ? 'bg-calm text-white' : 'bg-busy-tint text-busy-fg'
          }`}
        >
          {step}
        </span>
        <h2 className="font-display text-lead flex-1 leading-tight font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        <Icon
          name={ok ? 'check_circle' : 'error'}
          size={20}
          filled
          className={ok ? 'text-calm' : 'text-busy'}
        />
      </div>
      {children}
    </section>
  )
}

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
    <DeviceFrame title="한적">
      <div className="flex flex-col gap-4 px-6 pt-6 pb-10">
        <header className="zin">
          <p className="font-display text-muted text-caption font-semibold tracking-[0.08em] uppercase">
            Working skeleton
          </p>
          <h2 className="font-display mt-4 text-hero leading-[1.18] font-bold tracking-[-0.02em]">
            뼈대 진단
          </h2>
          <p className="text-body mt-3 text-lead leading-relaxed">
            브라우저에서 시작해 Supabase와 예측 서비스까지 이어지는 경로가 실제로
            뚫렸는지 확인합니다.
          </p>
        </header>

        <div className="zin [animation-delay:0.06s]">
          <StatusCard step="1" title="Supabase 연결" ok={!error}>
            {error ? (
              <p className="text-busy-fg text-ui">{error.message}</p>
            ) : (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="font-display tabular text-hero leading-none font-extrabold tracking-[-0.03em]">
                    {count ?? 0}
                  </span>
                  <span className="text-muted text-label">건 조회됨</span>
                </div>
                <p className="text-faint mt-3 text-caption leading-relaxed">
                  0건이 정상입니다. KTO 시드를 아직 넣지 않았습니다. 조회가
                  됐다는 것만으로 RLS의 &ldquo;누구나 읽기&rdquo; 정책이 의도대로
                  동작함이 확인됩니다.
                </p>
              </>
            )}
          </StatusCard>
        </div>

        <div className="zin [animation-delay:0.12s]">
          <StatusCard
            step="2"
            title="혼잡 예측 서비스"
            ok={Boolean(forecast && peak)}
          >
            {forecast && peak ? (
              <>
                <div className="mb-4 flex items-end justify-between gap-3">
                  <div>
                    <p className="text-muted text-label">가장 붐비는 시간</p>
                    <p className="font-display mt-1 flex items-baseline gap-1.5">
                      <span className="tabular text-hero leading-none font-extrabold tracking-[-0.03em]">
                        {peak.hour_slot}
                      </span>
                      <span className="text-body text-lead font-semibold">
                        시
                      </span>
                    </p>
                  </div>
                  <CongestionTag pct={peak.congestion_pct} />
                </div>

                <CongestionGauge pct={peak.congestion_pct} />

                <p className="text-muted mt-6 mb-2 text-label">
                  시간대별 예측 · {forecast.slots.length}구간
                </p>
                <HoursChart slots={forecast.slots} nowHour={peak.hour_slot} />

                {forecast.is_mock && (
                  <p className="bg-terra-tint border-terra-bd text-terra-dark mt-4 flex items-start gap-2 rounded-xs border p-3 text-caption leading-relaxed">
                    <Icon name="info" size={16} className="mt-px" />
                    <span>
                      더미 곡선입니다. KTO 공공데이터로 교체해야 실제 예측이
                      됩니다.
                    </span>
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-busy-fg text-ui leading-relaxed">
                  예측 서비스 응답이 없습니다.
                </p>
                <p className="text-faint mt-2 text-caption leading-relaxed">
                  <code className="bg-sunk text-body rounded-[6px] px-1.5 py-0.5 font-mono text-micro">
                    cd predictor && ./.venv/bin/uvicorn app.main:app --port 8000
                  </code>
                  <br />
                  이 상태에서도 ①과 ③은 정상 동작해야 합니다. 예측 서비스가
                  죽어도 검색·즐겨찾기는 멈추지 않는다는 요구사항입니다.
                </p>
              </>
            )}
          </StatusCard>
        </div>

        <div className="zin [animation-delay:0.18s]">
          <AnonAuthProbe />
        </div>
      </div>
    </DeviceFrame>
  )
}
