import type { Metadata } from 'next';
import { VerifyEmailPanel } from '@/features/auth/verify-email-panel';

export const metadata: Metadata = { title: 'Confirmar e-mail', referrer: 'no-referrer' };

export default async function VerifyEmailPage({ searchParams }: PageProps<'/verificar-email'>) {
  const { token } = await searchParams;
  return <VerifyEmailPanel token={typeof token === 'string' ? token : null} />;
}
