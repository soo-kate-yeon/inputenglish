import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Transpile monorepo packages
  transpilePackages: ["@inputenglish/shared"],

  // Enable standalone output for Docker builds
  output: process.env.BUILD_STANDALONE === "true" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // The ffmpeg binary is copied into apps/web/bin/ffmpeg by the `prebuild`
  // script (scripts/copy-ffmpeg.mjs). Include it in the serverless bundle
  // for the pronunciation routes. Co-locating a copy is more reliable
  // than tracing node_modules/ffmpeg-static because ffmpeg-static's
  // `files` array excludes the binary and Next.js bundling rewrites
  // its __dirname resolution.
  outputFileTracingIncludes: {
    "/api/pronunciation/analyses/route": ["./bin/ffmpeg"],
    "/api/pronunciation/analyses/[analysisId]/route": ["./bin/ffmpeg"],
  },
  serverExternalPackages: ["ffmpeg-static"],

  // Production optimizations

  // Performance optimizations
  compiler: {
    removeConsole:
      process.env.NODE_ENV === "production"
        ? {
            exclude: ["error", "warn"],
          }
        : false,
  },

  // Image optimization
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
