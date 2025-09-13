// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  // Configuración para producción - sin ignorar errores
};

export default nextConfig;
