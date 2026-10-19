import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { PlayersAdmin } from '@/features/admin/players-admin';
import { requireSession } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Jogadores' };

export default async function AdminPlayersPage() {
  const { account } = await requireSession();
  if (!account.permissions.includes('players.manage')) {
    return null;
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Painel administrativo"
        title="Jogadores"
        description="Perfis esportivos: busca, correção de dados e moderação do avatar."
      />
      <PlayersAdmin />
    </div>
  );
}
