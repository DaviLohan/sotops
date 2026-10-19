import { ShieldAlert, ShieldX } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { requireSession } from '@/lib/auth/guards';
import { SessionProvider } from '@/lib/auth/session-context';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { account, csrfToken } = await requireSession();
  const canAccess = account.permissions.includes('admin.access');

  let content = children;
  if (account.mfaEnrollmentRequired) {
    content = (
      <EmptyState
        icon={ShieldAlert}
        title="Ative a verificação em duas etapas"
        description="Seu papel na federação exige um segundo fator de autenticação. O painel administrativo é liberado assim que ele for ativado."
        action={
          <Button asChild variant="primary">
            <Link href="/painel/seguranca">Ativar agora</Link>
          </Button>
        }
      />
    );
  } else if (!canAccess) {
    content = (
      <EmptyState
        icon={ShieldX}
        title="Acesso restrito"
        description="Sua conta não tem permissão para acessar o painel administrativo."
        action={
          <Button asChild>
            <Link href="/painel">Voltar para a área do jogador</Link>
          </Button>
        }
      />
    );
  }

  return (
    <SessionProvider value={{ account, csrfToken }}>
      <AppShell area={canAccess ? 'admin' : 'player'}>{content}</AppShell>
    </SessionProvider>
  );
}
