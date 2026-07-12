import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Fully static export. The absence of a server is itself what backs the privacy guarantee
  output: "export",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
