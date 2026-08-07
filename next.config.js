/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['mongoose'],
  },
  // Windows / Desktop + sync: ลด HMR/แคช .next ไม่สอดคล้อง (JS/CSS หน้าเละ สีหาย, chunk หาย)
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        poll: 2000,
        aggregateTimeout: 500,
        ignored: ['**/node_modules/**', '**/.git/**'],
      }
    }
    return config
  },
}

module.exports = nextConfig
