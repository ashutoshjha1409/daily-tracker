/** @type {import('next').NextConfig} */
const isGhPages = process.env.GITHUB_PAGES === '1'
const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  ...(isGhPages && {
    basePath: '/daily-tracker',
    assetPrefix: '/daily-tracker/',
  }),
}

module.exports = nextConfig
