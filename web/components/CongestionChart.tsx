'use client'

import {
  Bar,
  BarChart,
  Rectangle,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { ComponentProps } from 'react'
import type { HourSlot } from '@/types/forecast'
import {
  CONGESTION_LABEL,
  CONGESTION_THRESHOLDS,
  congestionLevel,
  type CongestionLevel,
} from '@/utils/congestionLevel'

type ChartDatum = {
  hour: number
  pct: number
  level: CongestionLevel
  isNow: boolean
}

/** recharts 가 shape 함수에 넘기는 값. 막대 좌표 + 원본 데이터 한 건 */
type BarShapeProps = ComponentProps<typeof Rectangle> & { payload: ChartDatum }

/**
 * 시간대별 혼잡 예측 그래프 (PRD ⑤ "장소 상세").
 *
 * PRD ④에서 "예상 혼잡 해소 시각"을 별도 기능으로 만들지 않기로 한 근거가
 * 이 그래프다 — 언제 여유로워지는지가 이미 눈에 보이기 때문이다.
 * 그래서 막대 색을 3구간으로 칠하고 70 경계선을 그린다. 높이만으로는
 * "이 정도면 혼잡인가?"를 판단할 수 없다.
 *
 * 색은 디자인 토큰을 그대로 쓴다. recharts 는 CSS 변수를 fill 로 받지 못해
 * 실제 색상값을 넘긴다 — globals.css 의 @theme 값과 같아야 한다.
 */
const FILL = {
  calm: '#aaa648',
  mid: '#e8b84b',
  busy: '#df6d41',
} as const

const AXIS_COLOR = '#8a968b'
const INK = '#1b3022'

export function CongestionChart({
  slots,
  nowHour,
}: {
  slots: HourSlot[]
  nowHour: number
}) {
  const data: ChartDatum[] = slots.map((s) => ({
    hour: s.hour_slot,
    pct: s.congestion_pct,
    level: congestionLevel(s.congestion_pct),
    isNow: s.hour_slot === nowHour,
  }))

  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, bottom: 0, left: -22 }}
          barCategoryGap={2}
        >
          <XAxis
            dataKey="hour"
            tickLine={false}
            axisLine={false}
            interval={2}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            tickFormatter={(h: number) => `${h}`}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 50, 100]}
            tickLine={false}
            axisLine={false}
            tick={{ fill: AXIS_COLOR, fontSize: 11 }}
            width={40}
          />

          {/* 혼잡 경계선. 어느 시간대가 기준을 넘는지 눈으로 확인되게 한다 */}
          <ReferenceLine
            y={CONGESTION_THRESHOLDS.busy}
            stroke="rgb(27 48 34 / 0.28)"
            strokeDasharray="4 4"
            label={{
              value: `혼잡 ${CONGESTION_THRESHOLDS.busy}`,
              position: 'insideTopRight',
              fill: AXIS_COLOR,
              fontSize: 11,
            }}
          />

          <Tooltip
            cursor={{ fill: 'rgb(27 48 34 / 0.05)' }}
            contentStyle={{
              background: '#fff',
              border: '1px solid #d7dfd7',
              borderRadius: 12,
              fontSize: 13,
              color: INK,
              boxShadow: '0 6px 20px rgb(27 48 34 / 0.12)',
            }}
            labelFormatter={(h) => `${h}시`}
            // value 에 타입을 직접 붙이면 recharts 의 Formatter 시그니처와
            // 어긋난다. 문맥 추론에 맡기고 안에서 숫자로 좁힌다.
            formatter={(value) => {
              const pct = Number(value)
              return [
                `${pct} · ${CONGESTION_LABEL[congestionLevel(pct)]}`,
                '혼잡 지수',
              ]
            }}
          />

          {/*
            막대마다 색이 달라야 해서 shape 로 직접 그린다.
            recharts 3 에서 Cell 컴포넌트는 deprecated 되고 shape 으로 옮겨졌다.
          */}
          <Bar
            dataKey="pct"
            isAnimationActive={false}
            shape={(props) => {
              const { payload, ...rect } = props as unknown as BarShapeProps
              return (
                <Rectangle
                  {...rect}
                  radius={[4, 4, 0, 0]}
                  fill={FILL[payload.level]}
                  // 현재 시각 막대만 진하게 — 지금이 어디인지 놓치지 않게
                  fillOpacity={payload.isNow ? 1 : 0.55}
                  stroke={payload.isNow ? INK : undefined}
                  strokeWidth={payload.isNow ? 1.5 : 0}
                />
              )
            }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
