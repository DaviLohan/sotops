import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { TransfersQueue } from '@/features/admin/transfers-queue';
import { requireSession } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Transferências' };

export default async function AdminTransfersPage() {
  const { account } = await requireSession();
  if (!account.permissions.includes('transfers.decide')) {
    return null;
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Painel administrativo"
        title="Transferências"
        description="Aprovar cria o novo vínculo e encerra o anterior; o histórico não muda."
      />
      <TransfersQueue />
    </div>
  );
}
