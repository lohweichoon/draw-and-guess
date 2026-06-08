import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // Allow PartyKit to be treated as external in dev
  transpilePackages: [],
}

export default nextConfig
