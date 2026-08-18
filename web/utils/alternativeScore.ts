import type { TravelMode } from '@/types/travel'

/**
 * ⚠️ 임시 대안 스코어링. 나중에 FastAPI 예측 서비스가 이 계산을 대체한다.
 *
 * PRD ⑦ 기준 최종 형태는 "혼잡 + 이동 + 날씨 가중합"을 FastAPI(pandas)가
 * 계산해 내려주는 것이다. 여기 있는 건 화면을 먼저 검증하기 위한 자리이며,
 * FastAPI 가 붙으면 이 파일은 응답을 그대로 받아쓰는 형태로 바뀐다.
 * 그때도 아래 ScoreBreakdown 모양은 유지해서 화면 코드는 건드리지 않는다.
 *
 * 날씨는 아직 어디에도 연결돼 있지 않다. PRD ⑥ 에서 날씨는 테이블이 아니라
 * API 호출로 처리하기로 했고, 그 연동은 예측 서비스 몫이다.
 */

/** 혼잡이 스코어에서 차지하는 비중 */
const CONGESTION_WEIGHT = 0.6
/** 접근성이 차지하는 비중 */
const ACCESS_WEIGHT = 0.4

/**
 * 이동수단별 "멀다"의 기준(km).
 * 도보는 3km 를 넘으면 사실상 후보가 아니고, 차는 15km 까지도 감수한다.
 * 인터뷰에서 확인된 행동 패턴("도보면 기다리지만 차면 즉시 이탈")의
 * 반대편 — 차로 움직일 각오가 섰다면 거리 자체는 덜 중요해진다.
 */
const DISTANCE_LIMIT_KM: Record<TravelMode, number> = { walk: 3, car: 15 }

export type ScoreBreakdown = {
  /** 최종 점수 0~100. 높을수록 좋은 대안 */
  total: number
  /** 혼잡 항목 점수(=100-혼잡지수)와 그 기여분 */
  congestionScore: number
  /** 접근성 항목 점수와 그 기여분 */
  accessScore: number
  /** access_desc 에서 읽어낸 도보 분. 못 읽으면 null */
  transitMinutes: number | null
}

/**
 * "3호선 안국역 3번 출구 도보 5분" 같은 문장에서 도보 분을 읽는다.
 * 형식이 제각각이라 못 읽는 경우가 정상이며, 그때는 중간값으로 취급한다.
 */
export function parseWalkMinutes(accessDesc: string | null): number | null {
  if (!accessDesc) return null
  const m = accessDesc.match(/도보\s*(\d+)\s*분/)
  return m ? Number(m[1]) : null
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, n))
}

/**
 * 접근성 점수 0~100. 역에서 걷는 시간과 기준 장소로부터의 거리를 반반 본다.
 * 거리 기준이 이동수단에 따라 달라지는 게 이 함수에서 mode 가 하는 일이다.
 */
function accessibilityScore(
  distanceKm: number,
  walkMinutes: number | null,
  mode: TravelMode,
): number {
  // 역에서 도보 5분이면 75점, 15분이면 25점. 못 읽으면 중간(50)으로 둔다
  const transit = walkMinutes === null ? 50 : clamp(100 - walkMinutes * 5)

  // 기준 장소에서 멀수록 감점. 한계 거리를 넘으면 0
  const proximity = clamp(100 - (distanceKm / DISTANCE_LIMIT_KM[mode]) * 100)

  return transit * 0.5 + proximity * 0.5
}

export function scoreAlternative({
  congestionPct,
  distanceKm,
  accessDesc,
  mode,
}: {
  /** 현재 시간대 혼잡 지수. 예측치가 없으면 null */
  congestionPct: number | null
  distanceKm: number
  accessDesc: string | null
  mode: TravelMode
}): ScoreBreakdown {
  // 예측치가 없으면 판단 근거가 없다. 낙관하지 않고 중간값으로 둬서
  // 데이터가 있는 후보에 밀리게 한다.
  const congestionScore = congestionPct === null ? 50 : clamp(100 - congestionPct)

  const walkMinutes = parseWalkMinutes(accessDesc)
  const accessScore = accessibilityScore(distanceKm, walkMinutes, mode)

  return {
    total: Math.round(
      congestionScore * CONGESTION_WEIGHT + accessScore * ACCESS_WEIGHT,
    ),
    congestionScore: Math.round(congestionScore),
    accessScore: Math.round(accessScore),
    transitMinutes: walkMinutes,
  }
}

/** 화면에 근거를 밝힐 때 쓰는 가중치 표기 */
export const SCORE_WEIGHTS = {
  congestion: CONGESTION_WEIGHT,
  access: ACCESS_WEIGHT,
} as const
