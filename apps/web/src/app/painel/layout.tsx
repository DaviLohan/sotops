import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/app-shell';
import { requireSession } from '@/lib/auth/guards';
import { SessionProvider } from '@/lib/auth/session-context';

export default async function PlayerLayout({ children }: { children: ReactNode }) {
  const { account, csrfToken } = await requireSession();
  return (
    <SessionProvider value={{ account, csrfToken }}>
      <AppShell area="player">{children}</AppShell>
    </SessionProvider>
  );
}
