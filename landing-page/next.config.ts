import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== 'production';

const nextConfig: NextConfig = {
  reactStrictMode: false,
  output: isDev ? undefined : 'export',
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups', // REQUIRED by Google Identity Platform
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'unsafe-none' // Required for some auth flows if strict
          }
        ],
      },
    ];
  },
};

export default nextConfig;
