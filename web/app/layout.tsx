import type { Metadata, Viewport } from "next";
import { Manrope, Hanken_Grotesk } from "next/font/google";
import { ICON_FONT_URL } from "@/utils/icons";
import "./globals.css";

/*
 * 프로토타입의 서체 구성을 그대로 옮긴다.
 * 라틴은 Manrope(제목)·Hanken Grotesk(본문), 한글은 Pretendard.
 *
 * 이 둘은 next/font/google 로 셀프 호스팅한다 — 빌드 시 폰트 파일을 받아
 * 우리 도메인에서 서빙하므로 외부 요청이 없고 레이아웃 흔들림도 없다.
 * Pretendard는 Google Fonts에 없어 globals.css 에서 CDN으로 불러온다.
 *
 * weight를 지정하지 않으면 가변 폰트(variable)를 받아 모든 굵기를 쓸 수 있다.
 */
const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
  display: "swap",
});

export const metadata: Metadata = {
  title: "한적 — 서울 관광지 혼잡도",
  description:
    "서울 관광지의 혼잡도를 예측하고, 한적한 대안 여행지를 함께 보여줍니다.",
};

export const viewport: Viewport = {
  // 모바일 앱 화면 기준으로 설계된 UI라 확대/축소 기준을 맞춰둔다
  width: "device-width",
  initialScale: 1,
  themeColor: "#e7ede7",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${manrope.variable} ${hanken.variable} h-full antialiased`}
    >
      {/*
       * 아이콘 서체는 CSS @import 로 넣을 수 없다 — Next.js 가
       * fonts.googleapis.com 의 @import 를 제거한다. link 로 실어야 한다.
       * 쓰는 아이콘만 서브셋해서 받는다 (utils/icons.ts).
       */}
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={ICON_FONT_URL} />
      <body className="min-h-full">{children}</body>
    </html>
  );
}
