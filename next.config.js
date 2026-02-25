/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  env: {
    AIFM_CRON_SECRET: process.env.AIFM_CRON_SECRET || process.env.CRON_SECRET || '',
  },
  productionBrowserSourceMaps: false,
  serverExternalPackages: ['pdfkit', 'puppeteer-core'],
  experimental: {
    serverActions: {
      bodySizeLimit: '100mb',
    },
    middlewareClientMaxBodySize: '100mb',
  },
  async headers() {
    return [
      {
        source: '/chat',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, max-age=0' },
        ],
      },
      {
        source: '/api/version',
        headers: [
          { key: 'Cache-Control', value: 'private, no-cache, max-age=0' },
        ],
      },
    ];
  },
  eslint: {
    // Disable ESLint during production builds (run separately in CI)
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily ignore type errors during build
    // TODO: Fix all type errors and re-enable
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig;


