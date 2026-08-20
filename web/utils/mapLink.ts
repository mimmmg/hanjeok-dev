import type { IconName } from '@/utils/icons'

/**
 * 지도 앱 길찾기 링크 3사.
 *
 * PRD ⑥ 에서 이동시간을 테이블에 넣지 않기로 한 근거가 이 링크다 —
 * 정확한 경로와 소요시간은 지도 앱이 훨씬 잘 안내한다. 여러 곳을 붙이는 이유는
 * 사람마다 쓰는 앱이 다르기 때문이다. 하나만 두면 그 앱을 안 쓰는 사람은
 * 주소를 복사해 다른 앱에 붙여넣는 수고를 하게 된다.
 *
 * 좌표를 우선 쓴다. "서울 종로구 사직로 161" 같은 주소는 검색 결과가 여러 개일
 * 수 있지만 좌표는 한 점을 가리킨다. 게다가 집중률 API 로 들어온 장소 상당수는
 * 주소가 없고 좌표만 있어서, 주소에만 의존하면 길찾기가 통째로 사라진다.
 *
 * 티맵은 넣지 않는다. 웹 지도가 없어 tmap:// 앱 스킴뿐이고, 데스크톱에서는
 * 눌러도 아무 일이 일어나지 않는다. 죽은 버튼을 두는 쪽이 없는 쪽보다 나쁘다 —
 * 사용자는 앱 탓인지 자기 탓인지 알 수 없다. 앱으로 감싸게 되면 그때 넣는다.
 */

export type MapProvider = {
  key: 'kakao' | 'naver'
  /**
   * 각 사의 공식 표기를 그대로 쓴다. 카카오는 "카카오맵"(붙여쓰기),
   * 네이버는 "네이버 지도"(띄어쓰기)다. "맵"과 "지도"가 섞이는 건
   * 두 회사가 그렇게 이름 지었기 때문이고, 임의로 통일하면 오히려
   * 사용자가 아는 이름과 달라진다.
   */
  label: string
  icon: IconName
  url: string
  /** 버튼 배경에 쓸 브랜드 색 클래스 */
  brandClass: string
}

export function mapProviders({
  name,
  lat,
  lng,
  address,
}: {
  name: string
  lat: number | null
  lng: number | null
  address: string | null
}): MapProvider[] {
  const encodedName = encodeURIComponent(name)

  // 좌표가 없으면 이름·주소 검색으로 대신한다
  if (lat === null || lng === null) {
    const query = encodeURIComponent(address || name)
    return [
      {
        key: 'kakao',
        label: '카카오맵',
        icon: 'map',
        url: `https://map.kakao.com/?q=${query}`,
        brandClass: 'bg-kakao',
      },
      {
        key: 'naver',
        label: '네이버 지도',
        icon: 'navigation',
        url: `https://map.naver.com/p/search/${query}`,
        brandClass: 'bg-naver',
      },
    ]
  }

  return [
    {
      key: 'kakao',
      label: '카카오맵',
      icon: 'map',
      // link/to/{이름},{위도},{경도} — 목적지 길찾기가 바로 열린다
      url: `https://map.kakao.com/link/to/${encodedName},${lat},${lng}`,
      brandClass: 'bg-kakao',
    },
    {
      key: 'naver',
      label: '네이버 지도',
      icon: 'navigation',
      // v5 경로 형식은 경도,위도 순서다 — 뒤집으면 엉뚱한 곳으로 간다
      url: `https://map.naver.com/p/directions/-/${lng},${lat},${encodedName}/-/transit`,
      brandClass: 'bg-naver',
    },
  ]
}
