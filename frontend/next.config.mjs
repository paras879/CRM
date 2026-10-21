/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets a production build run beside a running dev server (NEXT_DIST_DIR=.next-check next build).
  distDir: process.env.NEXT_DIST_DIR || '.next',
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/api/v1/:path*`
          : 'http://localhost:4000/api/v1/:path*',
      },
    ];
  },
};

export default nextConfig;
