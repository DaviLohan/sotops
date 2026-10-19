import type { AuthState } from '@/lib/api/server';
import { SiteHeaderShell } from './site-header-shell';

/** Cabeçalho do portal. Só o "estar logado" chega ao cliente — nunca o token da sessão. */
export function SiteHeader({ auth }: { auth: AuthState }) {
  return <SiteHeaderShell signedIn={auth.kind === 'authenticated'} />;
}
