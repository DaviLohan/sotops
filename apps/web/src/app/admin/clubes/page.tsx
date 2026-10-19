import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { ClubsTable } from '@/features/admin/clubs-table';
import { requireSession } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Clubes' };

export default async function AdminClubsPage() {
  const { account } = await requireSession();
  if (!account.permissions.includes('clubs.manage')) {
    return null;
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Painel administrativo"
        title="Clubes"
        description="Cadastro, escudo, responsável e situação de cada clube."
      />
      <ClubsTable />
    </div>
  );
}
