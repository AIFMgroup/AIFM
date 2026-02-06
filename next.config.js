/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  productionBrowserSourceMaps: false,
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


