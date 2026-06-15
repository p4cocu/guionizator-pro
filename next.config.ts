import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Incluir en el bundle serverless los archivos que las route handlers leen con
  // `fs` en runtime: el cerebro base (brain/) y el conocimiento por cliente
  // (knowledge/clients/). Sin esto, Netlify no los empaqueta y `fs.readFileSync`
  // no encuentra los .md en producción.
  outputFileTracingIncludes: {
    "/api/ai/**": ["./brain/**/*", "./knowledge/**/*"],
  },
};

export default nextConfig;
