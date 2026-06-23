import type { NextConfig } from 'next';

/**
 * `/api/*` is proxied to the backend so the browser always talks to the same
 * origin (no CORS, no lost `Access-Control-Allow-Origin`). This replaces the
 * rewrite that previously lived in `vercel.json`.
 *
 * The default target is the ngrok tunnel used in production. For local dev
 * against a Nest service, set `API_PROXY_TARGET=http://localhost:3001` (or run
 * with `NEXT_PUBLIC_API_BASE_URL` pointed straight at the backend).
 */
const API_PROXY_TARGET =
  process.env.API_PROXY_TARGET ??
  'https://bloating-plausibly-ardently.ngrok-free.dev';

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
