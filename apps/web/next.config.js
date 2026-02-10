/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@repo/database"],
  serverExternalPackages: ['@prisma/client', '@prisma/adapter-pg', 'bcryptjs'],
};

export default nextConfig;
