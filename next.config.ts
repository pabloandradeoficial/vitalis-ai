import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Habilita Turbopack explicitamente (padrão no Next.js 16)
  turbopack: {},

  // Headers de segurança + permissão de câmera na rota do paciente
  async headers() {
    return [
      {
        source: "/session/:path*",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=*, microphone=self",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
