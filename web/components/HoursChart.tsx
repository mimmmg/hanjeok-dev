import type { HourSlot } from '@/types/forecast'
import { CONGESTION_STYLE, congestionLevel } from '@/utils/congestionLevel'

/**
 * 시간대별 혼잡 예측 막대 차트. prototype/style.css 의 .hours 를 옮긴 것.
 *
 * PRD ④에서 "예상 혼잡 해소 시각" 텍스트를 별도 기능으로 만들지 않기로 한
 * 근거가 이 차트다 — 언제 여유로워지는지가 시각적으로 이미 드러난다.
 *
 * 막대는 3구간 색을 그대로 쓴다. 한 장소 안에서도 시간대에 따라
 * 색이 바뀌어서 "몇 시에 가면 되는지"가 색으로 읽힌다.
 */
export function HoursChart({
  slots,
  nowHour,
}: {
  slots: HourSlot[]
  /** 현재 시각을 강조 표시. 넘기지 않으면 강조 없음 */
  nowHour?: number
}) {
  return (
    <div className="relative flex h-26 items-end gap-[5px]">
      {/* 혼잡 경계선(70) — 어느 막대가 기준을 넘었는지 한눈에 보이게 */}
      <div
        className="pointer-events-none absolute right-0 left-0 border-t border-dashed border-[rgb(27_48_34_/_0.13)]"
        style={{ bottom: '70%' }}
      >
        <span className="bg-screen font-mono text-faint absolute -top-3.5 right-0 pl-1 text-micro">
          혼잡 70
        </span>
      </div>

      {slots.map((s) => {
        const isNow = s.hour_slot === nowHour
        return (
          <div
            key={s.hour_slot}
            className="flex h-full flex-1 flex-col items-center justify-end gap-[7px]"
          >
            <div
              className={`w-full rounded-t-xs ${CONGESTION_STYLE[congestionLevel(s.congestion_pct)].fill}`}
              style={{
                height: `${s.congestion_pct}%`,
                animation: 'rise 0.5s cubic-bezier(0.22,0.68,0,1) both',
              }}
              title={`${s.hour_slot}시 · ${s.congestion_pct}`}
            />
            <span
              className={`font-mono text-micro ${isNow ? 'text-ink font-bold' : 'text-faint'}`}
            >
              {/* 3시간 간격만 표시 — 24개를 다 쓰면 430px에서 겹친다 */}
              {s.hour_slot % 3 === 0 ? s.hour_slot : ''}
            </span>
          </div>
        )
      })}
    </div>
  )
}
