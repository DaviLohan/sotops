import type { Metadata } from 'next';
import { LoginForm } from '@/features/auth/login-form';
import { safeNextPath } from '@/features/auth/form-helpers';
import { redirectIfAuthenticated } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Entrar' };

const NOTICES: Record<string, string> = {
  'senha-redefinida': 'Senha redefinida. Entre com a nova senha.',
};

export default async function LoginPage({ searchParams }: PageProps<'/entrar'>) {
  await redirectIfAuthenticated();
  const params = await searchParams;
  const next = typeof params.next === 'string' ? params.next : null;
  const notice = typeof params.aviso === 'string' ? NOTICES[params.aviso] : undefined;
  return <LoginForm nextPath={safeNextPath(next)} notice={notice} />;
}
