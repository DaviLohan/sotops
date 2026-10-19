import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { NewsAdmin } from '@/features/admin/news-admin';
import { requireSession } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Notícias' };

export default async function AdminNewsPage() {
  const { account } = await requireSession();
  if (!account.permissions.includes('content.manage')) {
    return null;
  }
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Painel administrativo"
        title="Notícias"
        description="Rascunhos, agendamentos e publicações exibidas na HOME."
      />
      <NewsAdmin />
    </div>
  );
}
