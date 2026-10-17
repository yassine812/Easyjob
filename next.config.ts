import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable dev compiling overlay indicator
  devIndicators: false,
  // The browser can reach the app through 127.0.0.1 while the dev server is
  // started on localhost; allow the HMR endpoint on that equivalent origin.
  allowedDevOrigins: ["127.0.0.1"],
  // The repo root contains the backend's package-lock.json; pin Turbopack to
  // the frontend workspace so it doesn't misdetect the workspace root.
  turbopack: {
    root: __dirname,
  },
  // Standalone output so the production Docker image is self-contained.
  output: "standalone",
  async headers() {
    return [{
      source: '/sw.js',
      headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }],
    }];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "*.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  experimental: {
    // reactCompiler is enabled by create-next-app; keep as-is.
  },
};

export default nextConfig;
