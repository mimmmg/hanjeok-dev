/**
 * 화면 작업용 서울 관광지 mock 데이터.
 *
 * ⚠️ 임시 데이터다. 실제 KTO TourAPI 연동 시 통째로 교체된다.
 *
 * kto_content_id 는 'mock-' 접두사를 붙인 임시 문자열이다.
 * 실제 연동 때는 TourAPI areaBasedList 의 contentid(숫자 문자열)로 바꾼다.
 * 접두사를 둔 이유는 나중에 `kto_content_id like 'mock-%'` 한 줄로
 * 임시 데이터만 골라 지울 수 있게 하기 위함이다.
 *
 * 좌표는 실제 위치의 근사값이다. 지도 링크·거리 계산이 그럴듯하게
 * 동작하는지 확인하는 용도이지, 정확도를 보장하지 않는다.
 */

/**
 * 혼잡 곡선 프로필. 장소 성격에 따라 하루 패턴이 다르다.
 * - palace: 궁·한옥마을. 09시 개장 18시 폐장이라 저녁에 0으로 떨어진다
 * - street: 상권·거리. 저녁에 정점을 찍고 밤늦게까지 이어진다
 * - park:   공원. 오후부터 올라 초저녁에 정점
 * - indoor: 실내 시설. 낮에 정점, 밤에 폐관
 */
export type CongestionProfile = 'palace' | 'street' | 'park' | 'indoor'

export type MockPlace = {
  kto_content_id: string
  name: string
  name_en: string
  category: string
  district: string
  address: string
  lat: number
  lng: number
  access_desc: string
  fee: string
  /** 혼잡 곡선 계산용. place 테이블에는 저장하지 않는다 */
  profile: CongestionProfile
  /** 장소별 인기도 배수 (0.6~1.15). 같은 프로필이어도 붐비는 정도가 다르다 */
  popularity: number
}

export const MOCK_PLACES: MockPlace[] = [
  {
    kto_content_id: 'mock-gyeongbokgung',
    name: '경복궁',
    name_en: 'Gyeongbokgung Palace',
    category: '고궁·유적',
    district: '종로구',
    address: '서울 종로구 사직로 161',
    lat: 37.5796,
    lng: 126.977,
    access_desc: '3호선 경복궁역 5번 출구 도보 1분',
    fee: '3,000원 (한복 착용 시 무료)',
    profile: 'palace',
    popularity: 1.15,
  },
  {
    kto_content_id: 'mock-changdeokgung',
    name: '창덕궁',
    name_en: 'Changdeokgung Palace',
    category: '고궁·유적',
    district: '종로구',
    address: '서울 종로구 율곡로 99',
    lat: 37.5794,
    lng: 126.991,
    access_desc: '3호선 안국역 3번 출구 도보 5분',
    fee: '3,000원 (후원 별도 5,000원)',
    profile: 'palace',
    popularity: 0.78,
  },
  {
    kto_content_id: 'mock-bukchon',
    name: '북촌한옥마을',
    name_en: 'Bukchon Hanok Village',
    category: '전통마을',
    district: '종로구',
    address: '서울 종로구 계동길 37',
    lat: 37.5826,
    lng: 126.9831,
    access_desc: '3호선 안국역 2번 출구 도보 8분',
    fee: '무료',
    profile: 'palace',
    popularity: 1.05,
  },
  {
    kto_content_id: 'mock-insadong',
    name: '인사동',
    name_en: 'Insadong',
    category: '거리·상권',
    district: '종로구',
    address: '서울 종로구 인사동길 62',
    lat: 37.5735,
    lng: 126.985,
    access_desc: '3호선 안국역 6번 출구 도보 3분',
    fee: '무료',
    profile: 'street',
    popularity: 0.86,
  },
  {
    kto_content_id: 'mock-gwangjang',
    name: '광장시장',
    name_en: 'Gwangjang Market',
    category: '전통시장',
    district: '종로구',
    address: '서울 종로구 창경궁로 88',
    lat: 37.5701,
    lng: 126.9997,
    access_desc: '1호선 종로5가역 8번 출구 도보 2분',
    fee: '무료',
    profile: 'street',
    popularity: 1.0,
  },
  {
    kto_content_id: 'mock-myeongdong',
    name: '명동',
    name_en: 'Myeongdong',
    category: '거리·상권',
    district: '중구',
    address: '서울 중구 명동길 14',
    lat: 37.5636,
    lng: 126.9827,
    access_desc: '4호선 명동역 6번 출구 바로',
    fee: '무료',
    profile: 'street',
    popularity: 1.15,
  },
  {
    kto_content_id: 'mock-namsan-tower',
    name: '남산서울타워',
    name_en: 'N Seoul Tower',
    category: '전망대',
    district: '용산구',
    address: '서울 용산구 남산공원길 105',
    lat: 37.5512,
    lng: 126.9882,
    access_desc: '4호선 명동역 3번 출구, 남산 케이블카 환승',
    fee: '전망대 21,000원',
    profile: 'indoor',
    popularity: 1.1,
  },
  {
    kto_content_id: 'mock-national-museum',
    name: '국립중앙박물관',
    name_en: 'National Museum of Korea',
    category: '박물관',
    district: '용산구',
    address: '서울 용산구 서빙고로 137',
    lat: 37.524,
    lng: 126.9803,
    access_desc: '4호선·경의중앙선 이촌역 2번 출구 도보 5분',
    fee: '무료 (특별전 별도)',
    profile: 'indoor',
    popularity: 0.72,
  },
  {
    kto_content_id: 'mock-itaewon',
    name: '이태원',
    name_en: 'Itaewon',
    category: '거리·상권',
    district: '용산구',
    address: '서울 용산구 이태원로 177',
    lat: 37.5346,
    lng: 126.9946,
    access_desc: '6호선 이태원역 1번 출구 바로',
    fee: '무료',
    profile: 'street',
    popularity: 0.82,
  },
  {
    kto_content_id: 'mock-hongdae',
    name: '홍대거리',
    name_en: 'Hongdae Street',
    category: '거리·상권',
    district: '마포구',
    address: '서울 마포구 양화로 160',
    lat: 37.5563,
    lng: 126.9236,
    access_desc: '2호선 홍대입구역 9번 출구 도보 3분',
    fee: '무료',
    profile: 'street',
    popularity: 1.12,
  },
  {
    kto_content_id: 'mock-yeouido-park',
    name: '여의도한강공원',
    name_en: 'Yeouido Hangang Park',
    category: '공원',
    district: '영등포구',
    address: '서울 영등포구 여의동로 330',
    lat: 37.5285,
    lng: 126.9327,
    access_desc: '5호선 여의나루역 2번 출구 도보 3분',
    fee: '무료',
    profile: 'park',
    popularity: 0.95,
  },
  {
    kto_content_id: 'mock-seoul-forest',
    name: '서울숲',
    name_en: 'Seoul Forest',
    category: '공원',
    district: '성동구',
    address: '서울 성동구 뚝섬로 273',
    lat: 37.5444,
    lng: 127.0374,
    access_desc: '수인분당선 서울숲역 3번 출구 도보 5분',
    fee: '무료',
    profile: 'park',
    popularity: 0.68,
  },
  {
    kto_content_id: 'mock-coex',
    name: '코엑스',
    name_en: 'COEX',
    category: '복합몰',
    district: '강남구',
    address: '서울 강남구 영동대로 513',
    lat: 37.5115,
    lng: 127.0595,
    access_desc: '2호선 삼성역 5번 출구 바로',
    fee: '무료 (전시 별도)',
    profile: 'indoor',
    popularity: 0.9,
  },
  {
    kto_content_id: 'mock-garosugil',
    name: '가로수길',
    name_en: 'Garosu-gil',
    category: '거리·상권',
    district: '강남구',
    address: '서울 강남구 강남대로162길',
    lat: 37.5205,
    lng: 127.023,
    access_desc: '3호선 신사역 8번 출구 도보 5분',
    fee: '무료',
    profile: 'street',
    popularity: 0.74,
  },
  {
    kto_content_id: 'mock-seoul-sky',
    name: '서울스카이',
    name_en: 'Seoul Sky',
    category: '전망대',
    district: '송파구',
    address: '서울 송파구 올림픽로 300',
    lat: 37.5125,
    lng: 127.1025,
    access_desc: '2호선·8호선 잠실역 1번 출구 연결',
    fee: '전망대 29,000원',
    profile: 'indoor',
    popularity: 1.02,
  },
]

/**
 * 프로필별 24시간 기준 곡선 (0~23시). 값은 인기도 배수와 흔들림을 적용하기 전의 기준선이다.
 * 낮과 저녁이 높고 새벽이 낮은 형태로, 실제 방문 패턴을 단순화한 것이다.
 */
export const PROFILE_CURVES: Record<CongestionProfile, number[]> = {
  // 09시 개장 · 18시 폐장. 낮 정점 후 저녁에 0으로 떨어진다
  palace: [
    0, 0, 0, 0, 0, 0, 0, 2, 8, 25, 45, 62, 70, 68, 72, 66, 52, 34, 16, 5, 2, 1,
    0, 0,
  ],
  // 저녁 정점. 밤늦게까지 이어지고 새벽에도 완전히 비지 않는다
  street: [
    18, 10, 6, 3, 2, 2, 4, 8, 14, 20, 28, 38, 48, 52, 55, 58, 62, 70, 80, 85,
    82, 70, 50, 30,
  ],
  // 오후부터 올라 초저녁 정점
  park: [
    5, 3, 2, 1, 1, 3, 8, 12, 15, 20, 28, 35, 40, 45, 50, 52, 55, 60, 68, 72, 65,
    48, 28, 12,
  ],
  // 실내 시설. 낮 정점, 밤 폐관
  indoor: [
    0, 0, 0, 0, 0, 0, 0, 0, 2, 12, 30, 48, 58, 66, 72, 74, 70, 62, 55, 48, 38,
    22, 6, 0,
  ],
}
