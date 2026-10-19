import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { UsersTable } from '@/features/admin/users-table';
import { requireSession } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Usuários' };

export default async function AdminUsersPage() {
  const { account } = await requireSession();
  if (!account.permissions.includes('users.read')) {
    return null;
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Painel administrativo"
        title="Usuários"
        description="Contas cadastradas, papéis de acesso e situação de cada uma."
      />
      <UsersTable />
    </div>
  );
}
