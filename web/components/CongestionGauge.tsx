import {
  CONGESTION_STYLE,
  CONGESTION_THRESHOLDS,
  congestionLevel,
} from '@/utils/congestionLevel'

/**
 * 혼잡 지수 게이지. prototype/style.css 의 .gauge 를 옮긴 것.
 *
 * 45 / 70 경계선을 함께 그리는 게 이 컴포넌트의 핵심이다.
 * 프로토타입 주석의 설명대로, 숫자와 색만 주면 "88이 왜 혼잡인지" 알 수 없다.
 * 경계선을 보여주면 사용자가 기준을 눈으로 확인할 수 있다.
 */
export function CongestionGauge({
  pct,
  showScale = true,
}: {
  pct: number
  showScale?: boolean
}) {
  const { fill } = CONGESTION_STYLE[congestionLevel(pct)]

  return (
    <div>
      <div
        className="bg-sunk relative h-2 overflow-hidden rounded-full"
        role="meter"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="혼잡 지수"
      >
        <div
          className={`h-full rounded-full ${fill}`}
          style={{ width: `${pct}%` }}
        />
        {/* 구간 경계선 — 게이지 채움 위에 겹쳐 그린다 */}
        {[CONGESTION_THRESHOLDS.mid, CONGESTION_THRESHOLDS.busy].map((t) => (
          <span
            key={t}
            className="absolute top-0 bottom-0 w-px bg-[rgb(27_48_34_/_0.22)]"
            style={{ left: `${t}%` }}
          />
        ))}
      </div>

      {showScale && (
        <div className="relative mt-1.5 h-3">
          <span className="font-mono text-faint absolute left-0 text-micro">
            0
          </span>
          <span
            className="font-mono text-faint absolute -translate-x-1/2 text-micro"
            style={{ left: `${CONGESTION_THRESHOLDS.mid}%` }}
          >
            45 보통
          </span>
          <span
            className="font-mono text-faint absolute -translate-x-1/2 text-micro"
            style={{ left: `${CONGESTION_THRESHOLDS.busy}%` }}
          >
            70 혼잡
          </span>
          <span className="font-mono text-faint absolute right-0 text-micro">
            100
          </span>
        </div>
      )}
    </div>
  )
}
