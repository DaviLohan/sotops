import path from 'node:path';
import type { NextConfig } from 'next';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * Política de conteúdo. O Next.js injeta scripts e estilos embutidos para hidratação, por isso
 * 'unsafe-inline' permanece até a adoção de nonces (pendência registrada para a Fase 6).
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDevelopment ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  `connect-src 'self'${isDevelopment ? ' ws:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
];

const nextConfig: NextConfig = {
  // A saída autocontida é usada apenas na imagem Docker; localmente `next start` serve o build padrão.
  output: process.env.NEXT_OUTPUT === 'standalone' ? 'standalone' : undefined,
  // Raiz do monorepositório: necessária para o rastreamento de arquivos da saída autocontida.
  outputFileTracingRoot: path.join(import.meta.dirname, '../..'),
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;
