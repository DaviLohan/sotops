'use client';

import {
  type AdminPlayerDto,
  type AdminUpdatePlayer,
  type AdminUpdatePlayerInput,
  adminUpdatePlayerSchema,
  GAME_PLATFORM_LABELS,
  GAME_PLATFORMS,
  type PaginatedResponse,
} from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Search, UserSearch } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ClubBadge } from '@/components/sport/club-badge';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { cn } from '@/lib/cn';
import { COUNTRY_OPTIONS, countryName } from '@/lib/countries';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { applyFieldErrors } from '../auth/form-helpers';

const PAGE_SIZE = 20;

export function PlayersAdmin() {
  const api = useApi();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdminPlayerDto | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const params = { page, pageSize: PAGE_SIZE, search: debouncedSearch };

  const players = useQuery({
    queryKey: ['admin-players', params],
    queryFn: ({ signal }) =>
      api.get<PaginatedResponse<AdminPlayerDto>>('/admin/players', params, signal),
    placeholderData: keepPreviousData,
  });

  return (
    <Card>
      <div className="border-b border-border p-4 sm:p-5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-subtle"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Buscar jogadores"
            placeholder="Buscar por apelido, ID do eFootball ou usuário"
            className="pl-9"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />
        </div>
      </div>

      {players.isError ? (
        <div className="p-5">
          <Callout
            tone="danger"
            title={messageFor(players.error)}
            action={
              <Button size="sm" onClick={() => players.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : players.isPending ? (
        <div className="flex flex-col gap-3 p-5" role="status" aria-label="Carregando jogadores">
          {Array.from({ length: 5 }, (_unused, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : players.data.data.length === 0 ? (
        <EmptyState
          icon={UserSearch}
          title={debouncedSearch ? 'Nenhum jogador encontrado' : 'Nenhum perfil de jogador'}
          description={
            debouncedSearch ? undefined : 'Os perfis aparecem quando os jogadores os criam.'
          }
        />
      ) : (
        <>
          <ul className={cn('divide-y divide-border', players.isPlaceholderData && 'opacity-60')}>
            {players.data.data.map((player) => (
              <li key={player.id} className="flex items-center justify-between gap-4 p-4 sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={player.nickname} src={player.avatarUrl} />
                  <div className="min-w-0">
                    <Link
                      href={`/jogadores/${player.slug}` as Route}
                      className="truncate font-medium text-fg hover:underline"
                    >
                      {player.nickname}
                    </Link>
                    <p className="truncate text-[0.8125rem] text-fg-subtle">
                      @{player.user.username} · {player.efootballId ?? 'sem ID'} ·{' '}
                      {GAME_PLATFORM_LABELS[player.platform]} · {countryName(player.country)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <ClubBadge club={player.club} size="sm" className="max-sm:hidden" />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Corrigir ${player.nickname}`}
                    onClick={() => setEditing(player)}
                  >
                    <Pencil />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination
            meta={players.data.meta}
            onPageChange={setPage}
            itemLabel="jogadores"
            disabled={players.isPlaceholderData}
          />
        </>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => (open ? undefined : setEditing(null))}
      >
        {editing ? (
          <PlayerDialog key={editing.id} player={editing} onClose={() => setEditing(null)} />
        ) : null}
      </Dialog>
    </Card>
  );
}

const FIELDS = ['nickname', 'efootballId', 'platform', 'country', 'region', 'reason'] as const;

function PlayerDialog({ player, onClose }: { player: AdminPlayerDto; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [avatarUrl, setAvatarUrl] = useState(player.avatarUrl);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<AdminUpdatePlayerInput, unknown, AdminUpdatePlayer>({
    resolver: zodResolver(adminUpdatePlayerSchema),
    defaultValues: {
      nickname: player.nickname,
      efootballId: player.efootballId ?? '',
      platform: player.platform,
      country: player.country,
      region: player.region ?? '',
      reason: '',
    },
  });

  const removeAvatar = useMutation({
    mutationFn: () => api.send('DELETE', `/admin/players/${player.id}/avatar`),
    onSuccess: async () => {
      setAvatarUrl(null);
      toast.success('Avatar removido.');
      await queryClient.invalidateQueries({ queryKey: ['admin-players'] });
    },
    onError: (error) => toast.error(messageFor(error)),
  });

  async function onSubmit(values: AdminUpdatePlayer) {
    try {
      await api.send('PUT', `/admin/players/${player.id}`, values);
      toast.success('Perfil corrigido.');
      await queryClient.invalidateQueries({ queryKey: ['admin-players'] });
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EFOOTBALL_ID_TAKEN') {
        setError('efootballId', { type: 'server', message: error.message });
        return;
      }
      if (!applyFieldErrors(error, setError, FIELDS)) {
        toast.error(messageFor(error));
      }
    }
  }

  return (
    <DialogContent
      title="Corrigir perfil"
      description={`@${player.user.username} · ${player.user.displayName}`}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
        <DialogBody className="grid gap-5 overflow-y-auto sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <Avatar name={player.nickname} src={avatarUrl} size="lg" />
            {avatarUrl ? (
              <Button
                type="button"
                size="sm"
                variant="danger"
                loading={removeAvatar.isPending}
                onClick={() => removeAvatar.mutate()}
              >
                Remover avatar impróprio
              </Button>
            ) : (
              <p className="text-[0.8125rem] text-fg-subtle">Sem avatar enviado.</p>
            )}
          </div>
          <FormField label="Apelido" error={errors.nickname?.message}>
            <Input {...register('nickname')} />
          </FormField>
          <FormField label="Plataforma" error={errors.platform?.message}>
            <NativeSelect {...register('platform')}>
              {GAME_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {GAME_PLATFORM_LABELS[platform]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="ID no eFootball" error={errors.efootballId?.message}>
            <Input spellCheck={false} {...register('efootballId')} />
          </FormField>
          <FormField label="País" error={errors.country?.message}>
            <NativeSelect {...register('country')}>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Região" error={errors.region?.message} className="sm:col-span-2">
            <Input {...register('region')} />
          </FormField>
          <FormField
            label="Motivo da correção"
            hint="Fica registrado na auditoria."
            error={errors.reason?.message}
            className="sm:col-span-2"
          >
            <Textarea rows={2} {...register('reason')} />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Salvar correção
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
