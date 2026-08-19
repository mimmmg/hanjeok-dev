import type { Metadata } from 'next'
import Link from 'next/link'
import { DeviceFrame } from '@/components/DeviceFrame'
import { Icon } from '@/components/Icon'
import type { IconName } from '@/utils/icons'

export const metadata: Metadata = {
  title: '한적 — 붐비는 주말은 피해서',
}

/**
 * 랜딩 화면 (prototype/01-landing.html).
 *
 * 이 화면만 상단 크롬이 없다. 제목 막대가 있으면 "앱 안의 한 화면"처럼
 * 보이는데, 여기는 앱을 소개하고 들여보내는 자리라 히어로가 화면 맨 위에서
 * 시작해야 한다.
 *
 * 데이터를 전혀 읽지 않아 정적으로 미리 생성된다. 첫 방문의 체감 속도가
 * 가장 중요한 화면이라 그게 맞다.
 *
 * 히어로 이미지는 아직 없다. 줄무늬 플레이스홀더 대신 팔레트 그라디언트로
 * 채웠다 — 미완성으로 보이지 않으면서, 사진이 생기면 배경만 바꾸면 된다.
 */

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'sensors',
    title: '검색과 동시에 혼잡도',
    body: '한국관광공사 관광지 데이터로 시간대별 혼잡 지수를 예측합니다.',
  },
  {
    icon: 'compare_arrows',
    title: '대안은 항상 여러 곳',
    body: '이동 시간·날씨·접근성을 나란히 놓고 직접 고를 수 있어요.',
  },
  {
    icon: 'bookmarks',
    title: '관심 장소 한 번에 훑기',
    body: '담아둔 후보를 혼잡도 순으로 넘겨보며 주말 계획을 정리하세요.',
  },
]

export default function LandingPage() {
  return (
    <DeviceFrame>
      {/* ── 히어로 ── */}
      <figure className="zin relative flex h-[460px] items-end px-6 pb-9">
        {/* 배경: 이른 아침 고궁의 색감을 팔레트 안에서 흉내낸다 */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(160deg,#D9E3D9_0%,#C7D6C9_38%,#E2D6C8_72%,#EDE3DA_100%)]"
        />
        {/* 아래로 갈수록 화면 배경색에 녹아들게 해 글자가 읽히게 한다 */}
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(to_top,var(--color-screen)_12%,rgb(241_245_241_/_0.55)_46%,rgb(241_245_241_/_0.05)_100%)]"
        />

        <div className="relative flex flex-col gap-3.5">
          <span className="bg-card flex size-11 items-center justify-center rounded-full text-[#725B29] shadow-[0_4px_20px_rgb(27_48_34_/_0.08)]">
            <Icon name="explore" size={22} filled />
          </span>
          <h1 className="font-display text-hero leading-[1.18] font-bold tracking-[-0.02em]">
            붐비는 주말은
            <br />
            피해서 떠나요
          </h1>
          <p className="text-body max-w-[300px] text-lead leading-relaxed">
            검색하는 순간 혼잡도가 함께 보입니다. 붐빈다면 근처의 여유로운
            대안까지 나란히 비교해 드려요.
          </p>
        </div>
      </figure>

      {/* ── 주동작 ── */}
      <div className="zin px-6 pb-8 [animation-delay:0.06s]">
        <Link
          href="/search"
          className="font-display bg-terra hover:bg-terra-link flex min-h-14 items-center justify-center gap-2 rounded-full px-5 text-base font-bold text-white transition-colors"
        >
          장소 검색하기
          <Icon name="arrow_forward" size={20} />
        </Link>
      </div>

      {/* ── 이 앱이 하는 일 ── */}
      <ul className="flex flex-col gap-5 px-6 pb-10">
        {FEATURES.map((feature, i) => (
          <li
            key={feature.title}
            className="zin flex items-start gap-3"
            style={{ animationDelay: `${0.06 * (i + 1)}s` }}
          >
            <span className="bg-card text-terra-dark flex size-10 flex-none items-center justify-center rounded-xs shadow-[0_2px_10px_rgb(27_48_34_/_0.05)]">
              <Icon name={feature.icon} size={22} />
            </span>
            <div>
              <h2 className="font-display text-ink text-base leading-tight font-semibold tracking-[-0.01em]">
                {feature.title}
              </h2>
              <p className="text-muted mt-1.5 text-label leading-relaxed">
                {feature.body}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </DeviceFrame>
  )
}
