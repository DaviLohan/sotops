'use client';

import {
  type ApiResponse,
  type PaginatedResponse,
  type RejectTransferInput,
  rejectTransferSchema,
  TRANSFER_STATUS_LABELS,
  TRANSFER_STATUSES,
  type TransferDto,
  type TransferStatus,
} from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRight, ArrowRightLeft } from 'lucide-react';
import type { Route } from 'next';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { ClubBadge } from '@/components/sport/club-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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
import { NativeSelect, Textarea } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { cn } from '@/lib/cn';
import { formatDateTime } from '@/lib/format';
import { TRANSFER_STATUS_TONES } from '@/lib/labels';

const PAGE_SIZE = 20;

export function TransfersQueue() {
  const api = useApi();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<TransferStatus>('PENDING_ADMIN');
  const [page, setPage] = useState(1);
  const [rejecting, setRejecting] = useState<TransferDto | null>(null);
  const params = { status, page, pageSize: PAGE_SIZE };

  const transfers = useQuery({
    queryKey: ['admin-transfers', params],
    queryFn: ({ signal }) =>
      api.get<PaginatedResponse<TransferDto>>('/admin/transfers', params, signal),
    placeholderData: keepPreviousData,
  });

  const approve = useMutation({
    mutationFn: (transfer: TransferDto) =>
      api.send<ApiResponse<TransferDto>>('POST', `/admin/transfers/${transfer.id}/approve`),
    onSuccess: async ({ data }) => {
      toast.success(`Transferência de ${data.player.nickname} aprovada.`);
      await queryClient.invalidateQueries({ queryKey: ['admin-transfers'] });
    },
    onError: (error) => toast.error(messageFor(error)),
  });

  return (
    <Card>
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:p-5">
        <NativeSelect
          aria-label="Filtrar por situação"
          className="sm:w-64"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as TransferStatus);
            setPage(1);
          }}
        >
          {TRANSFER_STATUSES.map((value) => (
            <option key={value} value={value}>
              {TRANSFER_STATUS_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
      </div>

      {transfers.isError ? (
        <div className="p-5">
          <Callout
            tone="danger"
            title={messageFor(transfers.error)}
            action={
              <Button size="sm" onClick={() => transfers.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : transfers.isPending ? (
        <div className="flex flex-col gap-3 p-5" role="status" aria-label="Carregando pedidos">
          {Array.from({ length: 4 }, (_unused, index) => (
            <Skeleton key={index} className="h-16" />
          ))}
        </div>
      ) : transfers.data.data.length === 0 ? (
        <EmptyState
          icon={ArrowRightLeft}
          title="Nenhum pedido nesta situação"
          description={
            status === 'PENDING_ADMIN' ? 'Todos os pedidos já foram analisados.' : undefined
          }
        />
      ) : (
        <>
          <ul className={cn('divide-y divide-border', transfers.isPlaceholderData && 'opacity-60')}>
            {transfers.data.data.map((transfer) => (
              <li
                key={transfer.id}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Avatar name={transfer.player.nickname} src={transfer.player.avatarUrl} />
                  <div className="min-w-0">
                    <Link
                      href={`/jogadores/${transfer.player.slug}` as Route}
                      className="font-medium text-fg hover:underline"
                    >
                      {transfer.player.nickname}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[0.8125rem] text-fg-muted">
                      <ClubBadge club={transfer.fromClub} size="sm" />
                      {transfer.fromClub?.name ?? 'Sem clube'}
                      <ArrowRight className="size-3.5 text-fg-subtle" aria-label="para" />
                      <ClubBadge club={transfer.toClub} size="sm" />
                      <span className="text-fg">{transfer.toClub.name}</span>
                    </div>
                    <p className="mt-1 text-[0.8125rem] text-fg-subtle">
                      Pedido em {formatDateTime(transfer.createdAt)}
                      {transfer.clubDecidedAt
                        ? ` · aceito pelo clube em ${formatDateTime(transfer.clubDecidedAt)}`
                        : ''}
                    </p>
                    {transfer.note ? (
                      <p className="mt-1 text-sm text-fg-muted">“{transfer.note}”</p>
                    ) : null}
                    {transfer.decisionReason ? (
                      <p className="mt-1 text-sm text-fg-muted">
                        Motivo: {transfer.decisionReason}
                      </p>
                    ) : null}
                  </div>
                </div>
                {transfer.status === 'PENDING_ADMIN' ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      loading={approve.isPending && approve.variables?.id === transfer.id}
                      disabled={approve.isPending}
                      onClick={() => approve.mutate(transfer)}
                    >
                      Aprovar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={approve.isPending}
                      onClick={() => setRejecting(transfer)}
                    >
                      Recusar
                    </Button>
                  </div>
                ) : (
                  <Badge tone={TRANSFER_STATUS_TONES[transfer.status]} dot>
                    {TRANSFER_STATUS_LABELS[transfer.status]}
                  </Badge>
                )}
              </li>
            ))}
          </ul>
          <Pagination
            meta={transfers.data.meta}
            onPageChange={setPage}
            itemLabel="pedidos"
            disabled={transfers.isPlaceholderData}
          />
        </>
      )}

      <Dialog
        open={rejecting !== null}
        onOpenChange={(open) => (open ? undefined : setRejecting(null))}
      >
        {rejecting ? (
          <RejectDialog transfer={rejecting} onClose={() => setRejecting(null)} />
        ) : null}
      </Dialog>
    </Card>
  );
}

function RejectDialog({ transfer, onClose }: { transfer: TransferDto; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RejectTransferInput>({
    resolver: zodResolver(rejectTransferSchema),
    defaultValues: { reason: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: RejectTransferInput) =>
      api.send('POST', `/admin/transfers/${transfer.id}/reject`, values),
    onSuccess: async () => {
      toast.success('Transferência recusada.');
      await queryClient.invalidateQueries({ queryKey: ['admin-transfers'] });
      onClose();
    },
  });

  return (
    <DialogContent
      title="Recusar transferência"
      description={`${transfer.player.nickname} → ${transfer.toClub.name}`}
    >
      <form
        onSubmit={handleSubmit((values) => mutation.mutate(values))}
        noValidate
        className="contents"
      >
        <DialogBody className="flex flex-col gap-4">
          {mutation.isError ? <Callout tone="danger" title={messageFor(mutation.error)} /> : null}
          <FormField
            label="Motivo"
            hint="O jogador verá este motivo; ele também fica na auditoria."
            error={errors.reason?.message}
          >
            <Textarea rows={3} autoFocus {...register('reason')} />
          </FormField>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button type="submit" variant="danger" loading={mutation.isPending}>
            Recusar
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
