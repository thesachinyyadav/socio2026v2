import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
      {
        protocol: "https",
        hostname: "img.recraft.ai",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
    // OPTIMIZATION: Enable image optimization caching
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year
  },
  // OPTIMIZATION: Enable compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  // OPTIMIZATION: Enable SWC minification
  swcMinify: true,
};

export default nextConfig;
