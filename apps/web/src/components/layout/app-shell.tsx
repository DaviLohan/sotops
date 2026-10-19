'use client';

import type { Permission } from '@efed/shared';
import {
  ArrowLeftRight,
  ArrowRightLeft,
  Gamepad2,
  LayoutDashboard,
  type LucideIcon,
  Shield,
  Menu,
  Newspaper,
  ScrollText,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Dialog as DialogPrimitive } from 'radix-ui';
import { type ReactNode, useState } from 'react';
import { Logo } from '@/components/brand/logo';
import { useSession } from '@/lib/auth/session-context';
import { cn } from '@/lib/cn';
import { UserMenu } from './user-menu';

type Area = 'player' | 'admin';

interface NavItem {
  href: Route;
  label: string;
  icon: LucideIcon;
  /** Correspondência exata (para a página inicial da área). */
  exact?: boolean;
  permission?: Permission;
}

/**
 * A navegação lista apenas módulos que existem. Cada fase acrescenta aqui os seus
 * (clubes, competições, partidas, central de OCR…).
 */
const NAVIGATION: Record<Area, { label: string; items: NavItem[] }> = {
  player: {
    label: 'Área do jogador',
    items: [
      { href: '/painel', label: 'Visão geral', icon: LayoutDashboard, exact: true },
      {
        href: '/painel/perfil',
        label: 'Perfil de jogador',
        icon: Gamepad2,
        permission: 'player_profile.manage',
      },
      { href: '/painel/clube', label: 'Meu clube', icon: Shield },
      { href: '/painel/conta', label: 'Minha conta', icon: UserRound },
      { href: '/painel/seguranca', label: 'Segurança', icon: ShieldCheck },
    ],
  },
  admin: {
    label: 'Painel administrativo',
    items: [
      {
        href: '/admin',
        label: 'Dashboard',
        icon: LayoutDashboard,
        exact: true,
        permission: 'dashboard.read',
      },
      { href: '/admin/usuarios', label: 'Usuários', icon: Users, permission: 'users.read' },
      {
        href: '/admin/jogadores',
        label: 'Jogadores',
        icon: Gamepad2,
        permission: 'players.manage',
      },
      { href: '/admin/clubes', label: 'Clubes', icon: Shield, permission: 'clubs.manage' },
      {
        href: '/admin/transferencias',
        label: 'Transferências',
        icon: ArrowRightLeft,
        permission: 'transfers.decide',
      },
      {
        href: '/admin/noticias',
        label: 'Notícias',
        icon: Newspaper,
        permission: 'content.manage',
      },
      {
        href: '/admin/configuracoes',
        label: 'Configurações',
        icon: Settings,
        permission: 'content.manage',
      },
      { href: '/admin/auditoria', label: 'Auditoria', icon: ScrollText, permission: 'audit.read' },
    ],
  },
};

function NavLinks({ area, onNavigate }: { area: Area; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { account } = useSession();
  const items = NAVIGATION[area].items.filter(
    (item) => !item.permission || account.permissions.includes(item.permission),
  );

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                active
                  ? 'bg-surface-raised text-fg'
                  : 'text-fg-muted hover:bg-surface-raised/60 hover:text-fg',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute top-2 bottom-2 left-0 w-0.5 rounded-full bg-accent transition-opacity',
                  active ? 'opacity-100' : 'opacity-0',
                )}
              />
              <item.icon
                className={cn(
                  'size-4',
                  active ? 'text-accent' : 'text-fg-subtle group-hover:text-fg-muted',
                )}
                aria-hidden="true"
              />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function SidebarContent({ area, onNavigate }: { area: Area; onNavigate?: () => void }) {
  const { account } = useSession();
  const canSwitchToAdmin = area === 'player' && account.permissions.includes('admin.access');
  const switchTarget =
    area === 'admin'
      ? { href: '/painel' as Route, label: 'Ir para a área do jogador' }
      : canSwitchToAdmin
        ? { href: '/admin' as Route, label: 'Ir para o painel administrativo' }
        : null;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-border px-5">
        <Link
          href="/"
          onClick={onNavigate}
          aria-label="Página inicial da federação"
          className="rounded-md"
        >
          <Logo />
        </Link>
      </div>
      <nav aria-label={NAVIGATION[area].label} className="flex-1 overflow-y-auto px-3 py-5">
        <p className="type-eyebrow mb-3 px-3 text-fg-subtle">{NAVIGATION[area].label}</p>
        <NavLinks area={area} onNavigate={onNavigate} />
      </nav>
      {switchTarget ? (
        <div className="border-t border-border p-3">
          <Link
            href={switchTarget.href}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-fg-muted hover:bg-surface-raised/60 hover:text-fg"
          >
            <ArrowLeftRight className="size-4 text-fg-subtle" aria-hidden="true" />
            {switchTarget.label}
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** Estrutura das áreas autenticadas: menu lateral fixo no desktop e gaveta no celular. */
export function AppShell({ area, children }: { area: Area; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-dvh lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface-sunken lg:block">
        <SidebarContent area={area} />
      </aside>

      <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-border bg-canvas/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
            <DialogPrimitive.Trigger
              aria-label="Abrir menu"
              className="flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-surface-raised hover:text-fg lg:hidden"
            >
              <Menu className="size-5" />
            </DialogPrimitive.Trigger>
            <DialogPrimitive.Portal>
              <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-overlay data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 lg:hidden" />
              <DialogPrimitive.Content
                aria-describedby={undefined}
                className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] border-r border-border bg-surface-sunken shadow-overlay duration-200 data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left data-[state=open]:animate-in data-[state=open]:slide-in-from-left lg:hidden"
              >
                <DialogPrimitive.Title className="sr-only">Menu de navegação</DialogPrimitive.Title>
                <SidebarContent area={area} onNavigate={() => setDrawerOpen(false)} />
              </DialogPrimitive.Content>
            </DialogPrimitive.Portal>
          </DialogPrimitive.Root>
          <p className="type-eyebrow text-fg-subtle lg:hidden">{NAVIGATION[area].label}</p>
        </div>
        <UserMenu />
      </header>

      <main id="conteudo" className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {children}
      </main>
    </div>
  );
}
