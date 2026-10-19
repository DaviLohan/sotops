'use client';

import { Menu, X } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog } from 'radix-ui';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { SiteSearch } from './site-search';

/** Somente o que existe: as âncoras apontam para seções reais da HOME. */
export const PORTAL_NAV: { href: Route; label: string }[] = [
  { href: '/', label: 'Início' },
  { href: '/#competicoes' as Route, label: 'Competições' },
  { href: '/#partidas' as Route, label: 'Partidas' },
  { href: '/#classificacao' as Route, label: 'Classificação' },
  { href: '/jogadores', label: 'Jogadores' },
  { href: '/clubes', label: 'Clubes' },
  { href: '/#noticias' as Route, label: 'Notícias' },
];

/**
 * Cabeçalho do portal. Transparente sobre o hero da HOME; ao rolar, ganha fundo escuro, desfoque
 * sutil e uma borda discreta. Nas demais páginas já nasce sólido.
 */
export function SiteHeaderShell({ signedIn }: { signedIn: boolean }) {
  const pathname = usePathname();
  const overlay = pathname === '/';
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const solid = !overlay || scrolled;
  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b transition-[background-color,border-color,backdrop-filter] duration-200',
        solid
          ? 'border-border bg-canvas-deep/90 backdrop-blur-sm'
          : 'border-transparent bg-transparent',
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Página inicial da federação" className="rounded-sm">
          <Logo compact />
        </Link>
        <nav aria-label="Principal" className="ml-4 hidden items-center gap-1 lg:flex">
          {PORTAL_NAV.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="type-small rounded-sm px-3 py-2 font-medium text-fg-muted transition-colors duration-150 hover:text-fg"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <SiteSearch />
          {signedIn ? (
            <Button asChild variant="primary" size="sm">
              <Link href="/painel">Abrir meu painel</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm" className="max-sm:hidden">
                <Link href="/entrar">Entrar</Link>
              </Button>
              <Button asChild variant="primary" size="sm">
                <Link href="/cadastro">Criar conta</Link>
              </Button>
            </>
          )}
          <Dialog.Root open={open} onOpenChange={setOpen}>
            <Dialog.Trigger asChild>
              <Button
                variant="secondary"
                size="icon-sm"
                className="lg:hidden"
                aria-label="Abrir menu"
              >
                <Menu aria-hidden="true" />
              </Button>
            </Dialog.Trigger>
            <Dialog.Portal>
              <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0" />
              <Dialog.Content className="fixed inset-y-0 right-0 z-50 flex w-[min(20rem,88vw)] flex-col border-l border-border-strong bg-canvas-deep p-5 duration-200 data-[state=open]:animate-in data-[state=open]:slide-in-from-right">
                <div className="flex items-center justify-between">
                  <Dialog.Title className="type-eyebrow text-fg-subtle">Menu</Dialog.Title>
                  <Dialog.Close asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Fechar menu">
                      <X aria-hidden="true" />
                    </Button>
                  </Dialog.Close>
                </div>
                <Dialog.Description className="sr-only">
                  Navegação do portal da federação.
                </Dialog.Description>
                <nav aria-label="Principal" className="mt-4 flex flex-col">
                  {PORTAL_NAV.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className="type-display type-h3 border-b border-border py-4 text-fg"
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
                {signedIn ? null : (
                  <Button asChild variant="secondary" className="mt-6 sm:hidden">
                    <Link href="/entrar">Entrar</Link>
                  </Button>
                )}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      </div>
    </header>
  );
}
