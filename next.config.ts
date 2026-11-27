import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // presets/ are legacy specimens (data), never compiled
  outputFileTracingIncludes: { "/api/resurrect": ["./engine/**/*"] },
};

export default nextConfig;
