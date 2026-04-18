import path from "path";
import { fileURLToPath } from "url";
import type { NextConfig } from "next";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fallbackAppUrl = "https://sociodev.vercel.app";
const fallbackApiUrl = "https://sociodevserver.vercel.app/api";

const remoteImageHosts = (process.env.NEXT_PUBLIC_REMOTE_IMAGE_HOSTS || "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

if (remoteImageHosts.length === 0) {
  console.warn("Missing NEXT_PUBLIC_REMOTE_IMAGE_HOSTS. Falling back to built-in production hosts.");
  remoteImageHosts.push(
    "vkappuaapscvteexogtp.supabase.co",
    "placehold.co",
    "lh3.googleusercontent.com",
    "*.googleusercontent.com",
    "*.supabase.co",
    "christuniversity.in",
    "*.christuniversity.in"
  );
}

const remotePatterns = remoteImageHosts.map((hostname) => ({
  protocol: "https" as const,
  hostname,
  pathname: "/**",
}));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  outputFileTracingRoot: path.join(__dirname, ".."),
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || fallbackAppUrl,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || fallbackApiUrl,
    NEXT_PUBLIC_PWA_URL: process.env.NEXT_PUBLIC_PWA_URL || fallbackAppUrl,
    NEXT_PUBLIC_EVENT_IMAGE_PLACEHOLDER_URL:
      process.env.NEXT_PUBLIC_EVENT_IMAGE_PLACEHOLDER_URL ||
      "https://placehold.co/400x250/e2e8f0/64748b?text=Event+Image",
    NEXT_PUBLIC_EVENT_BANNER_PLACEHOLDER_URL:
      process.env.NEXT_PUBLIC_EVENT_BANNER_PLACEHOLDER_URL ||
      "https://placehold.co/1200x400/e2e8f0/64748b?text=Event+Banner",
    NEXT_PUBLIC_GOOGLE_CALENDAR_BASE_URL:
      process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_BASE_URL ||
      "https://calendar.google.com/calendar/render?action=TEMPLATE",
  },
  images: {
    remotePatterns,
    // OPTIMIZATION: Enable image optimization caching
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year
  },
  // OPTIMIZATION: Enable compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // SEO & Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none';",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains; preload",
          },
        ],
      },
      {
        source: "/manifest.json",
        headers: [
          {
            key: "Content-Type",
            value: "application/manifest+json",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
