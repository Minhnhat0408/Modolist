import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  // Required for correct standalone output path in pnpm monorepo
  outputFileTracingRoot: path.join(__dirname, '../..'),
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'bcryptjs'],
  images: {
    remotePatterns: [
      new URL('https://lh3.googleusercontent.com/**'),
      // Wildcard covers all Spotify CDN subdomains (i.scdn.co, mosaic.scdn.co, etc.)
      { protocol: 'https', hostname: '**.scdn.co', pathname: '/**' },
      { protocol: 'https', hostname: '**.spotifycdn.com', pathname: '/**' },
    ],
  },
  async rewrites() {
    // INTERNAL_API_URL: Railway private networking (http://api.railway.internal:3001)
    // falls back to NEXT_PUBLIC_API_URL for local dev / other deploys
    // eslint-disable-next-line no-undef
    const apiUrl = process.env.INTERNAL_API_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path((?!auth|spotify).*)',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
