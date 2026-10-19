'use client';

import type { AuditLogDto, PaginatedResponse } from '@efed/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ChevronDown, ScrollText } from 'lucide-react';
import { Fragment, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { NativeSelect } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@/components/ui/table';
import { messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { AUDIT_ACTION_GROUPS, auditActionLabel, auditActionTone } from '@/lib/labels';

const PAGE_SIZE = 25;

function DetailRow({ event }: { event: AuditLogDto }) {
  const details: [string, string][] = [
    ['Ação', event.action],
    ['Recurso', event.entityType ? `${event.entityType} ${event.entityId ?? ''}`.trim() : '—'],
    ['Origem', event.ipAddress ?? '—'],
    ['Requisição', event.requestId ?? '—'],
  ];
  return (
    <div className="grid gap-4 bg-surface-sunken px-5 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:px-6">
      <dl className="flex flex-col gap-2 text-[0.8125rem]">
        {details.map(([label, value]) => (
          <div key={label} className="flex gap-3">
            <dt className="w-24 shrink-0 text-fg-subtle">{label}</dt>
            <dd className="min-w-0 font-mono break-all text-fg-muted">{value}</dd>
          </div>
        ))}
      </dl>
      <div>
        <p className="type-eyebrow mb-2 text-fg-subtle">Metadados</p>
        {event.metadata ? (
          <pre className="overflow-x-auto rounded-md border border-border bg-canvas p-3 font-mono text-xs text-fg-muted">
            {JSON.stringify(event.metadata, null, 2)}
          </pre>
        ) : (
          <p className="text-[0.8125rem] text-fg-subtle">Sem metadados.</p>
        )}
      </div>
    </div>
  );
}

export function AuditTable() {
  const api = useApi();
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  const params = { page, pageSize: PAGE_SIZE, action };
  const events = useQuery({
    queryKey: ['admin-audit', params],
    queryFn: ({ signal }) =>
      api.get<PaginatedResponse<AuditLogDto>>('/admin/audit-logs', params, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <p className="text-sm text-fg-muted">
          Registros somente de inserção: não podem ser alterados nem apagados.
        </p>
        <NativeSelect
          aria-label="Filtrar por tipo de evento"
          className="sm:w-64"
          value={action}
          onChange={(event) => {
            setAction(event.target.value);
            setPage(1);
            setExpanded(null);
          }}
        >
          {AUDIT_ACTION_GROUPS.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </NativeSelect>
      </div>

      {events.isError ? (
        <div className="p-5">
          <Callout
            tone="danger"
            title={messageFor(events.error)}
            action={
              <Button size="sm" onClick={() => events.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : events.isPending ? (
        <div className="flex flex-col gap-3 p-5" role="status" aria-label="Carregando eventos">
          {Array.from({ length: 8 }, (_unused, index) => (
            <Skeleton key={index} className="h-10" />
          ))}
        </div>
      ) : events.data.data.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="Nenhum evento encontrado"
          description={
            action
              ? 'Não há registros para este tipo de evento.'
              : 'A auditoria ainda não tem registros.'
          }
          action={
            action ? <Button onClick={() => setAction('')}>Ver todos os eventos</Button> : undefined
          }
        />
      ) : (
        <>
          <TableContainer
            className={cn(
              'transition-opacity',
              events.isPlaceholderData ? 'opacity-60' : undefined,
            )}
          >
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Quando</TableHeaderCell>
                  <TableHeaderCell>Evento</TableHeaderCell>
                  <TableHeaderCell>Autor</TableHeaderCell>
                  <TableHeaderCell className="hidden md:table-cell">Origem</TableHeaderCell>
                  <TableHeaderCell className="w-12">
                    <span className="sr-only">Detalhes</span>
                  </TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {events.data.data.map((event) => {
                  const open = expanded === event.id;
                  return (
                    <Fragment key={event.id}>
                      <TableRow className={open ? 'border-b-0 bg-surface-raised/50' : undefined}>
                        <TableCell className="tabular whitespace-nowrap text-fg-muted">
                          <time dateTime={event.occurredAt}>
                            {formatDateTime(event.occurredAt)}
                          </time>
                        </TableCell>
                        <TableCell>
                          <Badge tone={auditActionTone(event.action)}>
                            {auditActionLabel(event.action)}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">
                          {event.actor ? (
                            <span className="text-fg">@{event.actor.username}</span>
                          ) : (
                            <span className="text-fg-subtle">Visitante</span>
                          )}
                        </TableCell>
                        <TableCell className="hidden font-mono text-[0.8125rem] whitespace-nowrap text-fg-muted md:table-cell">
                          {event.ipAddress ?? '—'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-expanded={open}
                            aria-controls={`audit-detail-${event.id}`}
                            aria-label={open ? 'Ocultar detalhes' : 'Ver detalhes'}
                            onClick={() => setExpanded(open ? null : event.id)}
                          >
                            <ChevronDown
                              className={cn(
                                'transition-transform',
                                open ? 'rotate-180' : undefined,
                              )}
                            />
                          </Button>
                        </TableCell>
                      </TableRow>
                      {open ? (
                        <tr id={`audit-detail-${event.id}`} className="border-b border-border">
                          <td colSpan={5} className="p-0">
                            <DetailRow event={event} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination
            meta={events.data.meta}
            onPageChange={(next) => {
              setPage(next);
              setExpanded(null);
            }}
            itemLabel="eventos"
            disabled={events.isPlaceholderData}
          />
        </>
      )}
    </Card>
  );
}
