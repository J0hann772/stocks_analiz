/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Proxy /api/v1/* to the FastAPI backend.
  // The destination uses the Docker internal service name "api".
  // At build time inside Docker: http://api:8000 is reachable.
  // In local dev (outside Docker): use NEXT_PUBLIC_API_URL or fallback localhost.
  async rewrites() {
    const target = process.env.API_INTERNAL_URL || 'http://localhost:8000';

    return [
      {
        source: '/api/v1/:path*',
        destination: `${target}/api/v1/:path*`,
      },
      {
        source: '/ws/:path*',
        destination: `${target}/ws/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
