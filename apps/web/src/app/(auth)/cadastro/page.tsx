import type { Metadata } from 'next';
import { RegisterForm } from '@/features/auth/register-form';
import { redirectIfAuthenticated } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Criar conta' };

export default async function RegisterPage() {
  await redirectIfAuthenticated();
  return <RegisterForm />;
}
