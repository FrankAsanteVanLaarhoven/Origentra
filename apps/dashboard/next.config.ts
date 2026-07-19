import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No external framework branding anywhere in the UI (hides the dev indicator).
  devIndicators: false,
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
