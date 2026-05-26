import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  assetPrefix: process.env.VERCEL ? "/operacao" : undefined,
};

export default nextConfig;
