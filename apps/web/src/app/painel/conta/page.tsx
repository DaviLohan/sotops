import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { ProfileForm } from '@/features/account/profile-form';

export const metadata: Metadata = { title: 'Minha conta' };

export default function AccountPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader eyebrow="Área do jogador" title="Minha conta" />
      <ProfileForm />
    </div>
  );
}
