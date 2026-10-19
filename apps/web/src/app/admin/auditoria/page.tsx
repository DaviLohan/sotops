import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { AuditTable } from '@/features/admin/audit-table';
import { requireSession } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Auditoria' };

export default async function AdminAuditPage() {
  const { account } = await requireSession();
  if (!account.permissions.includes('audit.read')) {
    return null;
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Painel administrativo"
        title="Auditoria"
        description="Histórico de ações sensíveis: acessos, alterações de segurança e decisões administrativas."
      />
      <AuditTable />
    </div>
  );
}
