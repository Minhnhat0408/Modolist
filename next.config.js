import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@supabase/ssr'],
  images: {
    remotePatterns: [
      new URL('https://lh3.googleusercontent.com/**'),
      // Wildcard covers all Spotify CDN subdomains (i.scdn.co, mosaic.scdn.co, etc.)
      { protocol: 'https', hostname: '**.scdn.co', pathname: '/**' },
      { protocol: 'https', hostname: '**.spotifycdn.com', pathname: '/**' },
    ],
  },
};

export default withNextIntl(nextConfig);
