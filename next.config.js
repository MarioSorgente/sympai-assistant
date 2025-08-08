/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ⬇️ PoC: don’t fail production builds on TS/ESLint
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
