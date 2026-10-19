'use client';

import { ROLE_LABELS } from '@efed/shared';
import { ChevronDown, LayoutDashboard, LogOut, ShieldCheck, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { messageFor } from '@/lib/api/errors';
import { useApi, useSession } from '@/lib/auth/session-context';
import { navigateWithReload } from '@/lib/navigation';

export function UserMenu() {
  const { account } = useSession();
  const api = useApi();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    try {
      await api.send('POST', '/auth/logout');
      navigateWithReload('/');
    } catch (error) {
      setLeaving(false);
      toast.error(messageFor(error));
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 text-left hover:bg-surface-raised data-[state=open]:bg-surface-raised"
        aria-label={`Menu da conta de ${account.displayName}`}
      >
        <Avatar name={account.displayName} size="sm" />
        <span className="hidden max-w-36 truncate text-sm font-medium text-fg sm:block">
          {account.displayName}
        </span>
        <ChevronDown className="size-4 text-fg-subtle" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <p className="truncate text-sm font-semibold text-fg">{account.displayName}</p>
          <p className="truncate text-[0.8125rem] text-fg-muted">@{account.username}</p>
          <p className="mt-1.5 text-xs text-fg-subtle">
            {account.roles.map((role) => ROLE_LABELS[role]).join(' · ')}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/painel">
            <LayoutDashboard aria-hidden="true" />
            Área do jogador
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/painel/conta">
            <UserRound aria-hidden="true" />
            Minha conta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/painel/seguranca">
            <ShieldCheck aria-hidden="true" />
            Segurança
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          tone="danger"
          disabled={leaving}
          onSelect={(event) => {
            event.preventDefault();
            void logout();
          }}
        >
          <LogOut aria-hidden="true" />
          {leaving ? 'Saindo…' : 'Sair'}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
