import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/ai/**": ["./brain/**/*", "./knowledge/**/*"],
    // El portal también lee esos archivos con `fs` desde sus server actions
    // (`lib/ai/clientKnowledge.ts` al adaptar un post, y la guía de portadas en
    // `lib/portal/scriptTools.ts`). Sin esta línea el bundle de Netlify no los
    // incluye y los helpers caen a "sin conocimiento" **en silencio**: la
    // generación funciona, pero con menos contexto que en local.
    "/portal/**": ["./brain/**/*", "./knowledge/**/*"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "500mb",
    },
  },
};

export default nextConfig;
