'use client';

import {
  type PublicClubListItem,
  type RejectTransferInput,
  rejectTransferSchema,
  type RequestTransfer,
  type RequestTransferInput,
  requestTransferSchema,
  type TransferDto,
} from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { NativeSelect, Textarea } from '@/components/ui/input';
import { messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { applyFieldErrors } from '../auth/form-helpers';

/** Executa uma ação da API, avisa o resultado e recarrega os dados da página. */
function useAction() {
  const api = useApi();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setPending(true);
    try {
      await action();
      toast.success(success);
      router.refresh();
      return true;
    } catch (error) {
      toast.error(messageFor(error));
      return false;
    } finally {
      setPending(false);
    }
  }
  return { api, pending, run };
}

export function LeaveClubButton({ clubName }: { clubName: string }) {
  const { api, pending, run } = useAction();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Sair do clube
        </Button>
      </DialogTrigger>
      <DialogContent title="Sair do clube" description={clubName}>
        <DialogBody>
          <p className="text-sm text-fg-muted">
            Seu vínculo termina hoje e fica no seu histórico. Para voltar, será preciso um novo
            pedido.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button
            variant="danger"
            loading={pending}
            onClick={async () => {
              if (await run(() => api.send('POST', '/me/club/leave'), 'Você saiu do clube.')) {
                setOpen(false);
              }
            }}
          >
            Sair do clube
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CancelTransferButton({ transferId }: { transferId: string }) {
  const { api, pending, run } = useAction();
  return (
    <Button
      variant="ghost"
      size="sm"
      loading={pending}
      onClick={() =>
        run(() => api.send('POST', `/me/transfers/${transferId}/cancel`), 'Pedido cancelado.')
      }
    >
      Cancelar pedido
    </Button>
  );
}

export function TransferRequestForm({
  clubs,
  currentClubSlug,
}: {
  clubs: PublicClubListItem[];
  currentClubSlug: string | null;
}) {
  const api = useApi();
  const router = useRouter();
  const options = clubs.filter((club) => club.slug !== currentClubSlug);
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<RequestTransferInput, unknown, RequestTransfer>({
    resolver: zodResolver(requestTransferSchema),
    defaultValues: { toClubSlug: '', note: '' },
  });

  async function onSubmit(values: RequestTransfer) {
    try {
      await api.send('POST', '/me/transfers', values);
      reset();
      toast.success('Pedido enviado.');
      router.refresh();
    } catch (error) {
      if (!applyFieldErrors(error, setError, ['toClubSlug', 'note'])) {
        toast.error(messageFor(error));
      }
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <div>
            <CardTitle>{currentClubSlug ? 'Pedir transferência' : 'Entrar em um clube'}</CardTitle>
            <CardDescription>
              O responsável pelo clube analisa o pedido, quando houver um; depois, a federação
              aprova.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5">
          {options.length === 0 ? (
            <Callout tone="info">Nenhum outro clube está recebendo jogadores no momento.</Callout>
          ) : (
            <FormField label="Clube" error={errors.toClubSlug?.message}>
              <NativeSelect {...register('toClubSlug')}>
                <option value="" disabled>
                  Selecione
                </option>
                {options.map((club) => (
                  <option key={club.slug} value={club.slug}>
                    {club.name} ({club.tag})
                  </option>
                ))}
              </NativeSelect>
            </FormField>
          )}
          <FormField
            label="Mensagem"
            hint="Opcional. Até 300 caracteres."
            error={errors.note?.message}
          >
            <Textarea rows={3} maxLength={300} {...register('note')} />
          </FormField>
        </CardContent>
        <CardFooter>
          <Button
            type="submit"
            variant="primary"
            loading={isSubmitting}
            disabled={options.length === 0}
          >
            Enviar pedido
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

/** Decisão do responsável pelo clube sobre um pedido de entrada. */
export function ClubRequestActions({ transfer }: { transfer: TransferDto }) {
  const { api, pending, run } = useAction();
  const [open, setOpen] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RejectTransferInput>({
    resolver: zodResolver(rejectTransferSchema),
    defaultValues: { reason: '' },
  });

  return (
    <div className="flex gap-2">
      <Button
        variant="primary"
        size="sm"
        loading={pending && !open}
        disabled={pending}
        onClick={() =>
          run(
            () => api.send('POST', `/me/club-requests/${transfer.id}/accept`),
            `${transfer.player.nickname} aceito. O pedido segue para a federação.`,
          )
        }
      >
        Aceitar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="sm" disabled={pending}>
            Recusar
          </Button>
        </DialogTrigger>
        <DialogContent title="Recusar pedido" description={transfer.player.nickname}>
          <form
            noValidate
            className="contents"
            onSubmit={handleSubmit(async (values) => {
              const done = await run(
                () => api.send('POST', `/me/club-requests/${transfer.id}/reject`, values),
                'Pedido recusado.',
              );
              if (done) setOpen(false);
            })}
          >
            <DialogBody>
              <FormField
                label="Motivo"
                hint="O jogador verá este motivo."
                error={errors.reason?.message}
              >
                <Textarea rows={3} autoFocus {...register('reason')} />
              </FormField>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="ghost">Cancelar</Button>
              </DialogClose>
              <Button type="submit" variant="danger" loading={pending}>
                Recusar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
