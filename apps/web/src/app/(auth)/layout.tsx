import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@/components/brand/logo';
import { PitchBackdrop } from '@/components/layout/pitch-backdrop';

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="relative isolate hidden overflow-hidden border-r border-border lg:flex lg:flex-col lg:justify-between lg:p-12">
        <PitchBackdrop className="-z-10" />
        <Link href="/" aria-label="Página inicial da federação" className="w-fit rounded-md">
          <Logo />
        </Link>
        <div>
          <p className="type-display max-w-md text-5xl text-fg">
            Cada placar com <span className="text-accent">evidência</span>. Cada decisão com
            registro.
          </p>
          <p className="mt-5 max-w-sm text-sm text-fg-muted">
            Sua conta dá acesso às competições da federação e ao histórico das suas partidas.
          </p>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-16 items-center px-4 sm:px-6 lg:hidden">
          <Link href="/" aria-label="Página inicial da federação" className="rounded-md">
            <Logo />
          </Link>
        </header>
        <main id="conteudo" className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
