import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { getAuthState, getFederationName } from '@/lib/api/server';

export async function generateMetadata(): Promise<Metadata> {
  const name = await getFederationName();
  return { title: { default: name, template: `%s · ${name}` } };
}

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const auth = await getAuthState();
  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader auth={auth} />
      <main id="conteudo" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
