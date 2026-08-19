'use client'

import { useGeolocation, type Coords } from '@/hooks/useGeolocation'
import { distanceKm, formatDistance } from '@/utils/distance'

/**
 * "내 위치에서 Xkm" 표시.
 *
 * 좌표를 받아 거리를 계산하는 일이 전부 이 컴포넌트 안(=브라우저)에서 끝난다.
 * 계산 결과인 거리조차 서버로 보내지 않는다.
 *
 * coords 를 넘기면 그것을 쓰고, 안 넘기면 스스로 위치를 요청한다.
 * 목록 화면처럼 항목이 여러 개일 때 항목마다 위치를 요청하면 낭비라,
 * 위에서 한 번 받아 내려주도록 열어둔 것이다.
 *
 * 권한이 없거나 실패하면 아무것도 그리지 않는다 — 거리 표시만 빠지고
 * 나머지 화면은 그대로 동작해야 한다는 게 PRD ⑦ 의 요구다.
 */
export function DistanceFromMe({
  lat,
  lng,
  coords: providedCoords,
  className = '',
}: {
  /** 대상 장소의 좌표. 없으면 거리를 낼 수 없다 */
  lat: number | null
  lng: number | null
  /** 위에서 이미 받아둔 사용자 좌표 */
  coords?: Coords | null
  className?: string
}) {
  // 좌표를 위에서 받았으면 스스로 요청하지 않는다
  const state = useGeolocation({ enabled: providedCoords === undefined })
  const coords =
    providedCoords ?? (state.status === 'granted' ? state.coords : null)

  if (!coords || lat === null || lng === null) return null

  const km = distanceKm(coords, { lat, lng })

  return (
    <span className={className}>내 위치에서 {formatDistance(km)}</span>
  )
}
