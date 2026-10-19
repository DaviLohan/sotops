'use client';

import {
  type AdminUserDto,
  assignableRolesFor,
  type PaginatedResponse,
  ROLE_KEYS,
  ROLE_LABELS,
  USER_STATUS_LABELS,
  USER_STATUSES,
} from '@efed/shared';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  rowSortingFeature,
  type SortingState,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Ban,
  EllipsisVertical,
  RotateCcw,
  Search,
  ShieldCheck,
  ShieldOff,
  UserCog,
  UserSearch,
} from 'lucide-react';
import { useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import { Dialog } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useApi, useCan, useSession } from '@/lib/auth/session-context';
import { cn } from '@/lib/cn';
import { formatDate, formatRelative } from '@/lib/format';
import { ROLE_TONES, STATUS_TONES } from '@/lib/labels';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { RolesDialog, StatusDialog } from './user-dialogs';

const PAGE_SIZE = 20;
const EMPTY_ROWS: AdminUserDto[] = [];
const features = tableFeatures({ rowSortingFeature });
const columnHelper = createColumnHelper<typeof features, AdminUserDto>();

type ActiveDialog = { kind: 'roles' | 'status'; user: AdminUserDto } | null;

/** Colunas secundárias só aparecem quando há largura; no celular viram selos na primeira coluna. */
const SECONDARY_COLUMN_CLASS = 'hidden lg:table-cell';
const isSecondary = (columnId: string) => columnId !== 'displayName';

const columns = columnHelper.columns([
  columnHelper.accessor('displayName', {
    header: 'Usuário',
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3 lg:min-w-52">
        <Avatar name={row.original.displayName} size="sm" />
        <div className="min-w-0">
          <p className="truncate font-medium text-fg">{row.original.displayName}</p>
          <p className="truncate text-[0.8125rem] text-fg-subtle">
            @{row.original.username} · {row.original.email}
          </p>
          {/* No celular as demais colunas ficam ocultas: o essencial aparece aqui. */}
          <div className="mt-1.5 flex flex-wrap gap-1.5 lg:hidden">
            <Badge tone={STATUS_TONES[row.original.status]} dot>
              {USER_STATUS_LABELS[row.original.status]}
            </Badge>
            {row.original.roles.map((role) => (
              <Badge key={role} tone={ROLE_TONES[role]}>
                {ROLE_LABELS[role]}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    ),
  }),
  columnHelper.accessor('status', {
    header: 'Situação',
    enableSorting: false,
    cell: ({ getValue }) => (
      <Badge tone={STATUS_TONES[getValue()]} dot>
        {USER_STATUS_LABELS[getValue()]}
      </Badge>
    ),
  }),
  columnHelper.accessor('roles', {
    header: 'Papéis',
    enableSorting: false,
    cell: ({ getValue }) => (
      <div className="flex flex-wrap gap-1.5">
        {getValue().map((role) => (
          <Badge key={role} tone={ROLE_TONES[role]}>
            {ROLE_LABELS[role]}
          </Badge>
        ))}
      </div>
    ),
  }),
  columnHelper.accessor('mfaEnabled', {
    header: 'MFA',
    enableSorting: false,
    cell: ({ getValue }) =>
      getValue() ? (
        <span className="inline-flex items-center gap-1.5 text-success">
          <ShieldCheck className="size-4" aria-hidden="true" />
          <span className="text-[0.8125rem]">Ativo</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1.5 text-fg-subtle">
          <ShieldOff className="size-4" aria-hidden="true" />
          <span className="text-[0.8125rem]">Inativo</span>
        </span>
      ),
  }),
  columnHelper.accessor('lastLoginAt', {
    header: 'Último acesso',
    cell: ({ getValue }) => {
      const value = getValue();
      return (
        <span className="whitespace-nowrap text-fg-muted">
          {value ? formatRelative(value) : 'Nunca'}
        </span>
      );
    },
  }),
  columnHelper.accessor('createdAt', {
    header: 'Cadastro',
    cell: ({ getValue }) => (
      <span className="whitespace-nowrap text-fg-muted">{formatDate(getValue())}</span>
    ),
  }),
]);

export function UsersTable() {
  const api = useApi();
  const { account } = useSession();
  const canManageRoles = useCan('users.manage_roles');
  const canManageStatus = useCan('users.manage_status');

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);
  const [sorting, setSorting] = useState<SortingState>([{ id: 'createdAt', desc: true }]);
  const [dialog, setDialog] = useState<ActiveDialog>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);

  const sort = sorting[0] ?? { id: 'createdAt', desc: true };
  const params = {
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch,
    status,
    role,
    sortBy: sort.id,
    sortDir: sort.desc ? 'desc' : 'asc',
  };

  const users = useQuery({
    queryKey: ['admin-users', params],
    queryFn: ({ signal }) =>
      api.get<PaginatedResponse<AdminUserDto>>('/admin/users', params, signal),
    placeholderData: keepPreviousData,
  });

  const table = useTable({
    features,
    columns,
    data: users.data?.data ?? EMPTY_ROWS,
    getRowId: (row) => row.id,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting((current) => (typeof updater === 'function' ? updater(current) : updater));
      setPage(1);
    },
    // A ordenação, os filtros e a paginação são feitos pela API.
    manualSorting: true,
    enableSortingRemoval: false,
    enableMultiSort: false,
  });

  const assignable = assignableRolesFor(account.roles);
  const canManage = (user: AdminUserDto) =>
    user.id !== account.id && user.roles.every((userRole) => assignable.includes(userRole));
  const hasFilters = Boolean(debouncedSearch || status || role);
  const showActions = canManageRoles || canManageStatus;

  function resetFilters() {
    setSearch('');
    setStatus('');
    setRole('');
    setPage(1);
  }

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
            aria-label="Buscar usuários"
            placeholder="Buscar por nome, usuário ou e-mail"
            className="pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:flex">
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
            {USER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {USER_STATUS_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect
            aria-label="Filtrar por papel"
            className="sm:w-48"
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os papéis</option>
            {ROLE_KEYS.map((value) => (
              <option key={value} value={value}>
                {ROLE_LABELS[value]}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      {users.isError ? (
        <div className="p-5">
          <Callout
            tone="danger"
            title={messageFor(users.error)}
            action={
              <Button size="sm" onClick={() => users.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : users.isPending ? (
        <div className="flex flex-col gap-3 p-5" role="status" aria-label="Carregando usuários">
          {Array.from({ length: 6 }, (_unused, index) => (
            <Skeleton key={index} className="h-12" />
          ))}
        </div>
      ) : users.data.data.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title={hasFilters ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
          description={
            hasFilters ? 'Ajuste a busca ou os filtros para ver outros resultados.' : undefined
          }
          action={hasFilters ? <Button onClick={resetFilters}>Limpar filtros</Button> : undefined}
        />
      ) : (
        <>
          <TableContainer
            className={cn('transition-opacity', users.isPlaceholderData ? 'opacity-60' : undefined)}
          >
            <Table>
              <TableHead>
                {table.getHeaderGroups().map((group) => (
                  <tr key={group.id}>
                    {group.headers.map((header) => {
                      const sorted = header.column.getIsSorted();
                      return (
                        <TableHeaderCell
                          key={header.id}
                          className={
                            isSecondary(header.column.id) ? SECONDARY_COLUMN_CLASS : undefined
                          }
                          aria-sort={
                            sorted === 'asc'
                              ? 'ascending'
                              : sorted === 'desc'
                                ? 'descending'
                                : undefined
                          }
                        >
                          {header.column.getCanSort() ? (
                            <button
                              type="button"
                              onClick={header.column.getToggleSortingHandler()}
                              className="type-eyebrow -mx-1 inline-flex items-center gap-1.5 rounded-sm px-1 py-1 whitespace-nowrap hover:text-fg"
                            >
                              <table.FlexRender header={header} />
                              {sorted === 'asc' ? (
                                <ArrowUp className="size-3.5 text-accent" aria-hidden="true" />
                              ) : sorted === 'desc' ? (
                                <ArrowDown className="size-3.5 text-accent" aria-hidden="true" />
                              ) : (
                                <ArrowUpDown className="size-3.5 opacity-50" aria-hidden="true" />
                              )}
                            </button>
                          ) : (
                            <table.FlexRender header={header} />
                          )}
                        </TableHeaderCell>
                      );
                    })}
                    {showActions ? (
                      <TableHeaderCell className="w-12">
                        <span className="sr-only">Ações</span>
                      </TableHeaderCell>
                    ) : null}
                  </tr>
                ))}
              </TableHead>
              <TableBody>
                {table.getRowModel().rows.map((row) => {
                  const user = row.original;
                  const manageable = canManage(user);
                  const canChangeStatus =
                    canManageStatus &&
                    manageable &&
                    (user.status === 'ACTIVE' || user.status === 'SUSPENDED');
                  const canChangeRoles = canManageRoles && manageable;
                  return (
                    <TableRow key={row.id}>
                      {row.getAllCells().map((cell) => (
                        <TableCell
                          key={cell.id}
                          className={
                            isSecondary(cell.column.id)
                              ? SECONDARY_COLUMN_CLASS
                              : 'max-w-0 w-full lg:max-w-none lg:w-auto'
                          }
                        >
                          <table.FlexRender cell={cell} />
                        </TableCell>
                      ))}
                      {showActions ? (
                        <TableCell className="text-right">
                          {canChangeRoles || canChangeStatus ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Ações para ${user.displayName}`}
                                >
                                  <EllipsisVertical />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {canChangeRoles ? (
                                  <DropdownMenuItem
                                    onSelect={() => setDialog({ kind: 'roles', user })}
                                  >
                                    <UserCog aria-hidden="true" />
                                    Gerenciar papéis
                                  </DropdownMenuItem>
                                ) : null}
                                {canChangeStatus ? (
                                  <DropdownMenuItem
                                    tone={user.status === 'ACTIVE' ? 'danger' : 'default'}
                                    onSelect={() => setDialog({ kind: 'status', user })}
                                  >
                                    {user.status === 'ACTIVE' ? (
                                      <Ban aria-hidden="true" />
                                    ) : (
                                      <RotateCcw aria-hidden="true" />
                                    )}
                                    {user.status === 'ACTIVE'
                                      ? 'Suspender conta'
                                      : 'Reativar conta'}
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <Pagination
            meta={users.data.meta}
            onPageChange={setPage}
            itemLabel="usuários"
            disabled={users.isPlaceholderData}
          />
        </>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => (open ? undefined : setDialog(null))}>
        {dialog?.kind === 'roles' ? (
          <RolesDialog user={dialog.user} onClose={() => setDialog(null)} />
        ) : null}
        {dialog?.kind === 'status' ? (
          <StatusDialog user={dialog.user} onClose={() => setDialog(null)} />
        ) : null}
      </Dialog>
    </Card>
  );
}
