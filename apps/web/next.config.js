/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@acme/api-types'],
  turbopack: { root: '../../' }, // Monorepo-Root, beseitigt die Warnung
  async rewrites() {
    return [{ source: '/api/:path*', destination: 'http://localhost:3000/:path*' }]; // API-Port ggf. anpassen
  },
};
module.exports = nextConfig;
