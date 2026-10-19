import type { Metadata } from 'next';
import { PageHeader } from '@/components/ui/page-header';
import { ChangePasswordCard } from '@/features/security/change-password-card';
import { MfaCard } from '@/features/security/mfa-card';
import { SessionsCard } from '@/features/security/sessions-card';

export const metadata: Metadata = { title: 'Segurança' };

export default function SecurityPage() {
  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow="Área do jogador"
        title="Segurança"
        description="Senha, verificação em duas etapas e dispositivos conectados."
      />
      <MfaCard />
      <ChangePasswordCard />
      <SessionsCard />
    </div>
  );
}
