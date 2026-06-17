import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/ai/**": ["./brain/**/*", "./knowledge/**/*"],
  },

};

export default nextConfig;
