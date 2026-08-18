/**
 * 두 좌표 사이의 직선거리(km). 하버사인 공식.
 *
 * 실제 도보·차 경로는 이보다 길다. 정확한 경로·소요시간은 카카오맵 길찾기
 * 링크가 대신하므로(PRD ⑥), 여기서는 대안 후보를 가까운 순으로 줄 세우는
 * 용도로만 쓴다.
 */

const EARTH_RADIUS_KM = 6371

function toRad(deg: number): number {
  return (deg * Math.PI) / 180
}

export function distanceKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/** 화면 표기용. 1km 미만은 m 로 보여준다 */
export function formatDistance(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)}m` : `${km.toFixed(1)}km`
}
