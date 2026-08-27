import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // Never let a type error slip into a build that touches payroll or tax.
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
