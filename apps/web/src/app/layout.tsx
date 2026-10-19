import '@fontsource/saira-condensed/600.css';
import '@fontsource/saira-condensed/700.css';
import './globals.css';
import { GeistMono } from 'geist/font/mono';
import { GeistSans } from 'geist/font/sans';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { DEFAULT_FEDERATION_NAME } from '@efed/shared';
import { Providers } from '@/components/layout/providers';

/** O portal troca pelo nome configurado (`(site)/layout.tsx`); aqui não há consulta à API no build. */
export const metadata: Metadata = {
  title: { default: DEFAULT_FEDERATION_NAME, template: `%s · ${DEFAULT_FEDERATION_NAME}` },
  description:
    'Campeonatos de eFootball 1x1 com regulamento, classificação automática e resultados conferidos.',
};

export const viewport: Viewport = {
  themeColor: '#080B20',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a
          href="#conteudo"
          className="sr-only rounded-md bg-accent px-4 py-2 font-semibold text-accent-fg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
        >
          Ir para o conteúdo
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
