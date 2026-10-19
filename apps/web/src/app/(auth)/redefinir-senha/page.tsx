import type { Metadata } from 'next';
import { ResetPasswordForm } from '@/features/auth/reset-password-form';

// O token viaja na URL: não deve vazar para outros sites pelo cabeçalho Referer.
export const metadata: Metadata = { title: 'Nova senha', referrer: 'no-referrer' };

export default async function ResetPasswordPage({ searchParams }: PageProps<'/redefinir-senha'>) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === 'string' ? token : null} />;
}
