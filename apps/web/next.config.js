/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/database"],
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'bcryptjs'],
  
  async rewrites() {
    // eslint-disable-next-line no-undef
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    return [
      {
        // Only rewrite non-auth API routes to backend NestJS
        // /api/auth/* routes are handled by Next.js (NextAuth + custom auth routes)
        source: '/api/:path((?!auth).*)',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
