import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // packages/shared의 TS 소스를 빌드 단계 없이 직접 소비
  transpilePackages: ["@ai-character/shared"],
};

export default nextConfig;
