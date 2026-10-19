import {
  type ApiResponse,
  type MfaStatusDto,
  ROLE_LABELS,
  type SessionDto,
  USER_STATUS_LABELS,
} from '@efed/shared';
import { CalendarDays, MonitorSmartphone, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { serverGet } from '@/lib/api/server';
import { requireSession } from '@/lib/auth/guards';
import { describeUserAgent, formatDate, formatRelative } from '@/lib/format';
import { ROLE_TONES, STATUS_TONES } from '@/lib/labels';

export const metadata: Metadata = { title: 'Visão geral' };

export default async function PlayerOverviewPage() {
  const { account } = await requireSession();
  const [{ data: mfa }, { data: sessions }] = await Promise.all([
    serverGet<ApiResponse<MfaStatusDto>>('/auth/mfa'),
    serverGet<ApiResponse<SessionDto[]>>('/auth/sessions'),
  ]);
  const otherSessions = sessions.filter((session) => !session.current);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader eyebrow="Área do jogador" title={`Olá, ${account.displayName}`} />

      {account.mfaEnrollmentRequired ? (
        <Callout
          tone="warning"
          title="Ative a verificação em duas etapas para administrar a federação"
          action={
            <Button asChild variant="primary" size="sm">
              <Link href="/painel/seguranca">Ativar agora</Link>
            </Button>
          }
        >
          Seu papel exige um segundo fator. Até a ativação, o painel administrativo fica bloqueado.
        </Callout>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Verificação em duas etapas"
          value={mfa.enabled ? 'Ativa' : 'Inativa'}
          icon={mfa.enabled ? ShieldCheck : ShieldAlert}
          tone={mfa.enabled ? 'default' : 'warning'}
          detail={
            mfa.enabled
              ? `${mfa.recoveryCodesRemaining} códigos de recuperação disponíveis`
              : 'Recomendada para proteger sua conta'
          }
        />
        <StatCard
          label="Sessões ativas"
          value={sessions.length}
          icon={MonitorSmartphone}
          detail={
            otherSessions.length > 0
              ? `${otherSessions.length} em outro dispositivo`
              : 'Somente este dispositivo'
          }
        />
        <StatCard
          label="Na federação desde"
          value={new Date(account.createdAt).getFullYear()}
          icon={CalendarDays}
          detail={formatDate(account.createdAt)}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Sua conta</CardTitle>
            <Button asChild size="sm">
              <Link href="/painel/conta">Editar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Avatar name={account.displayName} size="lg" />
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-fg">{account.displayName}</p>
                <p className="truncate text-sm text-fg-muted">@{account.username}</p>
              </div>
            </div>
            <dl className="mt-6 grid gap-4 border-t border-border pt-5 text-sm sm:grid-cols-2">
              <div className="min-w-0">
                <dt className="type-eyebrow text-fg-subtle">E-mail</dt>
                <dd className="mt-1.5 truncate text-fg">{account.email}</dd>
              </div>
              <div>
                <dt className="type-eyebrow text-fg-subtle">Situação</dt>
                <dd className="mt-1.5">
                  <Badge tone={STATUS_TONES[account.status]} dot>
                    {USER_STATUS_LABELS[account.status]}
                  </Badge>
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="type-eyebrow text-fg-subtle">Papéis</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {account.roles.map((role) => (
                    <Badge key={role} tone={ROLE_TONES[role]}>
                      {ROLE_LABELS[role]}
                    </Badge>
                  ))}
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Acessos recentes</CardTitle>
            <Button asChild size="sm">
              <Link href="/painel/seguranca">Gerenciar</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {sessions.slice(0, 4).map((session) => (
                <li
                  key={session.id}
                  className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm text-fg">
                      {describeUserAgent(session.userAgent)}
                    </p>
                    <p className="truncate text-[0.8125rem] text-fg-subtle">
                      {session.ipAddress ?? 'IP desconhecido'} · ativa{' '}
                      {formatRelative(session.lastSeenAt)}
                    </p>
                  </div>
                  {session.current ? <Badge tone="success">Esta sessão</Badge> : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
