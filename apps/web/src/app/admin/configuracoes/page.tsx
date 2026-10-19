import type { ApiResponse, FederationSettings } from '@efed/shared';
import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import {
  BannersCard,
  FeaturedCompetitionCard,
  FederationNameCard,
} from '@/features/admin/settings-admin';
import { serverGet } from '@/lib/api/server';
import { requireSession } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Configurações' };

export default async function AdminSettingsPage() {
  const { account } = await requireSession();
  const canSettings = account.permissions.includes('settings.manage');
  const canContent = account.permissions.includes('content.manage');
  if (!canSettings && !canContent) {
    return null;
  }
  const settings = canSettings
    ? (await serverGet<ApiResponse<FederationSettings>>('/admin/settings')).data
    : null;

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow="Painel administrativo"
        title="Configurações"
        description="Identidade da federação e o que abre a HOME do portal."
      />
      {settings ? <FederationNameCard initial={settings} /> : null}
      {canContent ? (
        <>
          <FeaturedCompetitionCard />
          <BannersCard />
        </>
      ) : null}
    </div>
  );
}
