'use client';

import {
  type AdminClubDto,
  CLUB_STATUS_LABELS,
  CLUB_STATUSES,
  type PaginatedResponse,
} from '@efed/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Search, Shield } from 'lucide-react';
import { useState } from 'react';
import { ClubBadge } from '@/components/sport/club-badge';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Input, NativeSelect } from '@/components/ui/input';
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
import { CLUB_STATUS_TONES } from '@/lib/labels';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { ClubDialog } from './club-dialog';

const PAGE_SIZE = 20;

export function ClubsTable() {
  const api = useApi();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<{ club?: AdminClubDto } | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const params = { page, pageSize: PAGE_SIZE, search: debouncedSearch, status };

  const clubs = useQuery({
    queryKey: ['admin-clubs', params],
    queryFn: ({ signal }) =>
      api.get<PaginatedResponse<AdminClubDto>>('/admin/clubs', params, signal),
    placeholderData: keepPreviousData,
  });
  const hasFilters = Boolean(debouncedSearch || status);

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Buscar clubes"
            placeholder="Buscar por nome ou sigla"
            className="pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <NativeSelect
          aria-label="Filtrar por situação"
          className="sm:w-48"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as situações</option>
          {CLUB_STATUSES.map((value) => (
            <option key={value} value={value}>
              {CLUB_STATUS_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
        <Button variant="primary" onClick={() => setDialog({})}>
          <Plus aria-hidden="true" />
          Novo clube
        </Button>
      </div>

      {clubs.isError ? (
        <div className="p-5">
          <Callout
            tone="danger"
            title={messageFor(clubs.error)}
            action={
              <Button size="sm" onClick={() => clubs.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : clubs.isPending ? (
        <div className="flex flex-col gap-3 p-5" role="status" aria-label="Carregando clubes">
          {Array.from({ length: 5 }, (_unused, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : clubs.data.data.length === 0 ? (
        <EmptyState
          icon={Shield}
          title={hasFilters ? 'Nenhum clube encontrado' : 'Nenhum clube cadastrado'}
          description={hasFilters ? 'Ajuste a busca ou o filtro.' : 'Cadastre o primeiro clube.'}
        />
      ) : (
        <>
          <TableContainer className={cn(clubs.isPlaceholderData && 'opacity-60')}>
            <Table>
              <TableHead>
                <tr>
                  <TableHeaderCell>Clube</TableHeaderCell>
                  <TableHeaderCell className="hidden md:table-cell">Situação</TableHeaderCell>
                  <TableHeaderCell className="hidden md:table-cell">Responsável</TableHeaderCell>
                  <TableHeaderCell className="hidden sm:table-cell">Jogadores</TableHeaderCell>
                  <TableHeaderCell className="w-12">
                    <span className="sr-only">Ações</span>
                  </TableHeaderCell>
                </tr>
              </TableHead>
              <TableBody>
                {clubs.data.data.map((club) => (
                  <TableRow key={club.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <ClubBadge club={club} />
                        <div className="min-w-0">
                          <p className="truncate font-medium text-fg">{club.name}</p>
                          <p className="truncate text-[0.8125rem] text-fg-subtle">
                            {club.tag} · /clubes/{club.slug}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge tone={CLUB_STATUS_TONES[club.status]} dot>
                        {CLUB_STATUS_LABELS[club.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-fg-muted md:table-cell">
                      {club.manager ? `@${club.manager.username}` : '—'}
                    </TableCell>
                    <TableCell className="hidden text-fg-muted sm:table-cell">
                      {club.members}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Editar ${club.name}`}
                        onClick={() => setDialog({ club })}
                      >
                        <Pencil />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination
            meta={clubs.data.meta}
            onPageChange={setPage}
            itemLabel="clubes"
            disabled={clubs.isPlaceholderData}
          />
        </>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => (open ? undefined : setDialog(null))}>
        {dialog ? (
          <ClubDialog
            key={dialog.club?.id ?? 'novo'}
            club={dialog.club}
            onClose={() => setDialog(null)}
          />
        ) : null}
      </Dialog>
    </Card>
  );
}
