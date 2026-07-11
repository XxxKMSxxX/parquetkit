import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 完全静的エクスポート。サーバーが存在しないこと自体がプライバシー保証の裏付け
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
