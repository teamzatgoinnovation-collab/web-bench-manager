import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@zatgo/ui", "@zatgo/icons", "@zatgo/utils"],
  serverExternalPackages: [],
};

export default nextConfig;
