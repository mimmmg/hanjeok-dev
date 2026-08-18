import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
   * Next.js 는 개발 서버의 dev 전용 자산(HMR 웹소켓 등)에 대해
   * localhost 외의 출처를 기본 차단한다. 그래서 같은 와이파이의 휴대폰이나
   * 맥의 네트워크 IP로 접속하면 콘솔에 403 + 웹소켓 연결 실패가 뜬다.
   *
   * 모바일 우선으로 만드는 화면이라 실제 폰에서 확인하는 게 중요해서,
   * 사설 IP 대역을 허용한다. 개발 모드에만 적용되며 배포에는 영향이 없다.
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.16.*.*"],
};

export default nextConfig;
