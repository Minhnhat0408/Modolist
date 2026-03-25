/** @type {import('next').NextConfig} */
const nextConfig = {
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
    // eslint-disable-next-line no-undef
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path((?!auth|spotify).*)',
        destination: `${apiUrl}/:path*`,
      },
    ];
  },
};

export default nextConfig;
