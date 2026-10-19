import {
  type ApiResponse,
  type AuditLogDto,
  type DashboardSummaryDto,
  type PaginatedResponse,
  ROLE_KEYS,
  ROLE_LABELS,
  USER_STATUS_LABELS,
  USER_STATUSES,
} from '@efed/shared';
import { KeyRound, MonitorSmartphone, ShieldAlert, UserPlus, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { RegistrationsChart } from '@/features/admin/registrations-chart';
import { serverGet } from '@/lib/api/server';
import { requireSession } from '@/lib/auth/guards';
import { formatDateTime, formatNumber, formatRelative } from '@/lib/format';
import { auditActionLabel, auditActionTone, STATUS_TONES } from '@/lib/labels';

export const metadata: Metadata = { title: 'Dashboard' };

function registrationTrend(current: number, previous: number): string {
  if (previous === 0) {
    return current === 0 ? 'Sem cadastros nas últimas duas semanas' : 'Nenhum na semana anterior';
  }
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) {
    return 'Igual à semana anterior';
  }
  return `${change > 0 ? '+' : ''}${change}% em relação à semana anterior`;
}

export default async function AdminDashboardPage() {
  const { account } = await requireSession();
  // O layout exibe o aviso adequado quando falta permissão; aqui evitamos chamadas que falhariam.
  if (!account.permissions.includes('dashboard.read')) {
    return null;
  }

  const canReadAudit = account.permissions.includes('audit.read');
  const [{ data: summary }, recentEvents] = await Promise.all([
    serverGet<ApiResponse<DashboardSummaryDto>>('/admin/dashboard/summary'),
    canReadAudit
      ? serverGet<PaginatedResponse<AuditLogDto>>('/admin/audit-logs', { pageSize: 6 })
      : Promise.resolve(null),
  ]);
  const { users, security, roles } = summary;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Painel administrativo"
        title="Dashboard"
        description={`Indicadores calculados em ${formatDateTime(summary.generatedAt)}.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Usuários"
          value={formatNumber(users.total)}
          icon={Users}
          detail={`${formatNumber(users.byStatus.ACTIVE)} ativos · ${formatNumber(users.byStatus.PENDING_VERIFICATION)} aguardando verificação`}
        />
        <StatCard
          label="Cadastros em 7 dias"
          value={formatNumber(users.registeredLast7Days)}
          icon={UserPlus}
          detail={registrationTrend(users.registeredLast7Days, users.registeredPrevious7Days)}
        />
        <StatCard
          label="Sessões ativas"
          value={formatNumber(security.activeSessions)}
          icon={MonitorSmartphone}
          detail="Dispositivos conectados agora"
        />
        <StatCard
          label="Falhas de login em 24 h"
          value={formatNumber(security.failedLoginsLast24h)}
          icon={KeyRound}
          tone={security.failedLoginsLast24h >= 20 ? 'danger' : 'default'}
          detail="Tentativas com credenciais inválidas"
        />
      </div>

      {security.adminsWithoutMfa > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-5 py-4 text-sm">
          <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-fg">
            <strong className="font-semibold">
              {security.adminsWithoutMfa}{' '}
              {security.adminsWithoutMfa === 1
                ? 'conta administrativa está'
                : 'contas administrativas estão'}{' '}
              sem verificação em duas etapas
            </strong>
            <span className="text-fg-muted"> e por isso sem acesso ao painel até ativar.</span>
          </p>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Cadastros por dia</CardTitle>
              <CardDescription>Últimos 14 dias (UTC).</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <RegistrationsChart data={summary.registrationsByDay} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Composição</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div>
              <p className="type-eyebrow mb-3 text-fg-subtle">Por situação</p>
              <ul className="flex flex-col gap-2.5 text-sm">
                {USER_STATUSES.map((status) => (
                  <li key={status} className="flex items-center justify-between gap-3">
                    <Badge tone={STATUS_TONES[status]} dot>
                      {USER_STATUS_LABELS[status]}
                    </Badge>
                    <span className="tabular font-medium text-fg">
                      {formatNumber(users.byStatus[status])}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="border-t border-border pt-5">
              <p className="type-eyebrow mb-3 text-fg-subtle">Por papel</p>
              <ul className="flex flex-col gap-2.5 text-sm">
                {ROLE_KEYS.map((role) => (
                  <li key={role} className="flex items-center justify-between gap-3">
                    <span className="text-fg-muted">{ROLE_LABELS[role]}</span>
                    <span className="tabular font-medium text-fg">{formatNumber(roles[role])}</span>
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>

      {recentEvents ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Atividade recente</CardTitle>
              <CardDescription>Últimos eventos registrados na auditoria.</CardDescription>
            </div>
            <Button asChild size="sm">
              <Link href="/admin/auditoria">Ver auditoria</Link>
            </Button>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col divide-y divide-border">
              {recentEvents.data.map((event) => (
                <li
                  key={event.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1.5 py-3 first:pt-0 last:pb-0"
                >
                  <Badge tone={auditActionTone(event.action)}>
                    {auditActionLabel(event.action)}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm text-fg-muted">
                    {event.actor ? `@${event.actor.username}` : 'Visitante'}
                  </span>
                  <time dateTime={event.occurredAt} className="text-[0.8125rem] text-fg-subtle">
                    {formatRelative(event.occurredAt)}
                  </time>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
