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
    remotePatterns: [new URL('https://lh3.googleusercontent.com/**')],
  },
  async rewrites() {
    // eslint-disable-next-line no-undef
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path((?!auth).*)',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
