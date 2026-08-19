/**
 * 카카오맵 길찾기 링크.
 *
 * PRD ⑥ 에서 이동시간을 테이블에 넣지 않기로 한 근거가 이 링크다 —
 * 정확한 경로와 소요시간은 지도 앱이 훨씬 잘 안내한다.
 *
 * 좌표가 있으면 좌표로 길찾기를 연다. 주소 검색보다 정확하다:
 * "서울 종로구 사직로 161" 같은 주소는 검색 결과가 여러 개일 수 있지만
 * 좌표는 한 점을 가리킨다.
 *
 * 집중률 API 로 들어온 장소 중 상당수는 주소가 없고 좌표만 있어서,
 * 주소에만 의존하면 그런 곳에서 길찾기가 통째로 사라진다.
 */
export function kakaoDirectionsUrl({
  name,
  lat,
  lng,
  address,
}: {
  name: string
  lat: number | null
  lng: number | null
  address: string | null
}): string | null {
  if (lat !== null && lng !== null) {
    // to/{이름},{위도},{경도} — 목적지로 길찾기가 바로 열린다
    return `https://map.kakao.com/link/to/${encodeURIComponent(name)},${lat},${lng}`
  }
  if (address) {
    // 좌표가 없으면 주소 검색으로 대신한다
    return `https://map.kakao.com/?q=${encodeURIComponent(address)}`
  }
  return null
}
