import { getPredictorUrl } from '@/utils/predictor'
import { seoulHour } from '@/utils/seoulTime'

/**
 * 서울 날씨 — **서버 전용**.
 *
 * 예측 서비스에서 받아온다. 화면에 보여주는 값이 혼잡도 점수를 계산할 때 쓴
 * 값과 같아야 하기 때문이다. 다른 소스를 쓰면 "25도라고 써놓고 24도로
 * 계산된" 어긋남이 생기고, 나중에 점수를 되짚을 때 혼란만 남는다.
 *
 * 예측 서비스가 죽어 있으면 Open-Meteo 로 떨어진다. 키가 필요 없어서
 * Next.js 에 비밀값을 두지 않고도 실제 예보를 받을 수 있다 —
 * 날씨 API 키는 예측 서비스만 갖는다.
 *
 * 장소별로 나누지 않는다. 서비스 지역이 서울 한 도시라 구별 예보를 따로
 * 받을 실익이 없다. 그래서 화면 표기도 "이 장소의 날씨"가 아니라
 * "서울 날씨"로 적어야 정확하다.
 */

/** 서울 시청 부근 — 대표 지점 */
const SEOUL_LAT = 37.5665
const SEOUL_LNG = 126.978

const TIMEOUT_MS = 4_000

export type SeoulWeather = {
  /** 현재 시간대 기온(℃) */
  temperature: number
  /** 현재 시간대 강수 확률 0~100 */
  precipitationProb: number
  /** 값의 출처. 화면에서 "예보"임을 밝히는 근거 */
  provider: string
}

type PredictorWeather = {
  provider: string
  hours: { hour_slot: number; temperature: number; precipitation_prob: number }[]
}

async function fromPredictor(hour: number): Promise<SeoulWeather | null> {
  const baseUrl = getPredictorUrl()
  if (!baseUrl) return null

  try {
    const res = await fetch(new URL('/weather', baseUrl), {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      // 날씨는 시간 단위로 바뀐다. 매 요청마다 부르면 낭비고,
      // 하루 캐시하면 낡는다.
      next: { revalidate: 1800 },
    })
    if (!res.ok) return null

    const data = (await res.json()) as PredictorWeather
    const now = data.hours.find((h) => h.hour_slot === hour)
    if (!now) return null

    return {
      temperature: now.temperature,
      precipitationProb: now.precipitation_prob,
      provider: data.provider,
    }
  } catch {
    return null
  }
}

async function fromOpenMeteo(hour: number): Promise<SeoulWeather | null> {
  try {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(SEOUL_LAT))
    url.searchParams.set('longitude', String(SEOUL_LNG))
    url.searchParams.set('hourly', 'temperature_2m,precipitation_probability')
    url.searchParams.set('timezone', 'Asia/Seoul')
    url.searchParams.set('forecast_days', '1')

    const res = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      next: { revalidate: 1800 },
    })
    if (!res.ok) return null

    const data = (await res.json()) as {
      hourly?: {
        time: string[]
        temperature_2m: number[]
        precipitation_probability: number[]
      }
    }
    const hourly = data.hourly
    if (!hourly) return null

    const index = hourly.time.findIndex((t) => Number(t.slice(11, 13)) === hour)
    if (index < 0) return null

    return {
      temperature: hourly.temperature_2m[index],
      precipitationProb: hourly.precipitation_probability[index] ?? 0,
      provider: 'open-meteo',
    }
  } catch {
    return null
  }
}

/**
 * 지금 시각의 서울 날씨. 둘 다 실패하면 null 이고, 화면은 날씨 줄만 생략한다.
 */
export async function fetchSeoulWeather(): Promise<SeoulWeather | null> {
  const hour = seoulHour()
  return (await fromPredictor(hour)) ?? (await fromOpenMeteo(hour))
}
