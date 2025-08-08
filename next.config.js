/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // be forgiving for PoC builds
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true }
};
export default nextConfig;
