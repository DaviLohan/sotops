'use client';

import {
  type AdminClubDto,
  type ApiResponse,
  CLUB_STATUS_LABELS,
  CLUB_STATUSES,
  type ClubData,
  type ClubInput,
  clubInputSchema,
} from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageUp, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { ClubBadge } from '@/components/sport/club-badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { DialogBody, DialogClose, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input, NativeSelect } from '@/components/ui/input';
import { ApiError, messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { applyFieldErrors } from '../auth/form-helpers';

const FIELDS = [
  'name',
  'tag',
  'primaryColor',
  'secondaryColor',
  'foundedOn',
  'status',
  'managerUsername',
] as const;

/** Cadastro (sem `club`) ou edição de um clube, com o envio do escudo na edição. */
export function ClubDialog({ club, onClose }: { club?: AdminClubDto; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState(club);
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ClubInput, unknown, ClubData>({
    resolver: zodResolver(clubInputSchema),
    defaultValues: {
      name: club?.name ?? '',
      tag: club?.tag ?? '',
      primaryColor: club?.primaryColor ?? '#2445FF',
      secondaryColor: club?.secondaryColor ?? '#F8FAFF',
      foundedOn: club?.foundedOn ?? null,
      status: club?.status ?? 'ACTIVE',
      managerUsername: club?.manager?.username ?? '',
    },
  });
  const [name, tag, primaryColor, secondaryColor] = useWatch({
    control,
    name: ['name', 'tag', 'primaryColor', 'secondaryColor'],
  });

  async function onSubmit(values: ClubData) {
    try {
      await (club
        ? api.send<ApiResponse<AdminClubDto>>('PUT', `/admin/clubs/${club.id}`, values)
        : api.send<ApiResponse<AdminClubDto>>('POST', '/admin/clubs', values));
      toast.success(club ? 'Clube atualizado.' : 'Clube cadastrado.');
      await queryClient.invalidateQueries({ queryKey: ['admin-clubs'] });
      onClose();
    } catch (error) {
      if (!applyFieldErrors(error, setError, FIELDS)) {
        toast.error(messageFor(error));
      }
    }
  }

  return (
    <DialogContent
      title={club ? 'Editar clube' : 'Novo clube'}
      description={club ? `/clubes/${club.slug}` : 'A URL pública é gerada a partir do nome.'}
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
        <DialogBody className="grid gap-5 sm:grid-cols-2">
          <div className="flex items-center gap-4 sm:col-span-2">
            <ClubBadge
              club={{
                name: name || 'Clube',
                tag: (tag || '?').toUpperCase().slice(0, 4),
                primaryColor: /^#[0-9a-f]{6}$/i.test(primaryColor) ? primaryColor : '#000000',
                secondaryColor: /^#[0-9a-f]{6}$/i.test(secondaryColor) ? secondaryColor : '#FFFFFF',
                crestUrl: current?.crestUrl,
              }}
              size="xl"
            />
            <p className="text-[0.8125rem] text-fg-subtle">
              {current?.crestUrl
                ? 'Escudo enviado.'
                : 'Sem escudo enviado, o portal desenha o emblema com a sigla e as cores.'}
            </p>
          </div>
          <FormField label="Nome" error={errors.name?.message} className="sm:col-span-2">
            <Input autoFocus {...register('name')} />
          </FormField>
          <FormField label="Sigla" hint="De 2 a 4 letras ou números." error={errors.tag?.message}>
            <Input className="uppercase" maxLength={4} {...register('tag')} />
          </FormField>
          <FormField label="Situação" error={errors.status?.message}>
            <NativeSelect {...register('status')}>
              {CLUB_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {CLUB_STATUS_LABELS[status]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Cor principal" error={errors.primaryColor?.message}>
            <Input type="color" className="p-1" {...register('primaryColor')} />
          </FormField>
          <FormField label="Cor secundária" error={errors.secondaryColor?.message}>
            <Input type="color" className="p-1" {...register('secondaryColor')} />
          </FormField>
          <FormField label="Fundação" hint="Opcional." error={errors.foundedOn?.message}>
            <Input
              type="date"
              {...register('foundedOn', { setValueAs: (value: string) => value || null })}
            />
          </FormField>
          <FormField
            label="Responsável"
            hint="Nome de usuário. Aceita os pedidos de entrada."
            error={errors.managerUsername?.message}
          >
            <Input autoComplete="off" spellCheck={false} {...register('managerUsername')} />
          </FormField>
          {current ? (
            <CrestUpload club={current} onChange={setCurrent} className="sm:col-span-2" />
          ) : null}
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {club ? 'Salvar alterações' : 'Cadastrar clube'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function CrestUpload({
  club,
  onChange,
  className,
}: {
  club: AdminClubDto;
  onChange: (club: AdminClubDto) => void;
  className?: string;
}) {
  const api = useApi();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (file: File | null) => {
      if (!file) {
        return api.send<ApiResponse<AdminClubDto>>('DELETE', `/admin/clubs/${club.id}/crest`);
      }
      const form = new FormData();
      form.append('file', file);
      return api.send<ApiResponse<AdminClubDto>>('POST', `/admin/clubs/${club.id}/crest`, form);
    },
    onSuccess: async ({ data }) => {
      onChange(data);
      toast.success(data.crestUrl ? 'Escudo atualizado.' : 'Escudo removido.');
      await queryClient.invalidateQueries({ queryKey: ['admin-clubs'] });
    },
    onSettled: () => {
      if (input.current) input.current.value = '';
    },
  });
  const fieldError =
    mutation.error instanceof ApiError ? mutation.error.fieldErrors[0]?.message : undefined;

  return (
    <div className={className}>
      <p className="text-[0.8125rem] font-medium text-fg">Escudo</p>
      <p className="mb-3 text-[0.8125rem] text-fg-subtle">PNG, JPEG ou WebP de até 2 MB.</p>
      {mutation.isError ? (
        <Callout tone="danger" className="mb-3" title={fieldError ?? messageFor(mutation.error)} />
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Arquivo do escudo"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) mutation.mutate(file);
        }}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          loading={mutation.isPending}
          onClick={() => input.current?.click()}
        >
          <ImageUp aria-hidden="true" />
          {club.crestUrl ? 'Trocar escudo' : 'Enviar escudo'}
        </Button>
        {club.crestUrl ? (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate(null)}
          >
            <Trash2 aria-hidden="true" />
            Remover
          </Button>
        ) : null}
      </div>
    </div>
  );
}
