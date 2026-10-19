'use client';

import {
  type AdminBannerDto,
  type ApiResponse,
  type BannerData,
  type BannerInput,
  bannerInputSchema,
  COMPETITION_STATUS_LABELS,
  type CompetitionOption,
  type FederationSettings,
  federationSettingsSchema,
} from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image as ImageIcon, Pencil, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField } from '@/components/ui/form-field';
import { Input, NativeSelect } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { formatDateTime, fromDateTimeLocal, toDateTimeLocal } from '@/lib/format';
import { applyFieldErrors } from '../auth/form-helpers';

export function FederationNameCard({ initial }: { initial: FederationSettings }) {
  const api = useApi();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FederationSettings>({
    resolver: zodResolver(federationSettingsSchema),
    defaultValues: initial,
  });

  async function onSubmit(values: FederationSettings) {
    try {
      const { data } = await api.send<ApiResponse<FederationSettings>>(
        'PUT',
        '/admin/settings',
        values,
      );
      reset(data);
      toast.success('Nome da federação salvo.');
      router.refresh();
    } catch (error) {
      if (!applyFieldErrors(error, setError, ['federationName'])) {
        toast.error(messageFor(error));
      }
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <div>
            <CardTitle>Nome da federação</CardTitle>
            <CardDescription>
              Aparece no rodapé, no título das páginas e na assinatura dos e-mails. O logotipo muda
              junto com a marca definitiva.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <FormField label="Nome" error={errors.federationName?.message}>
            <Input maxLength={60} {...register('federationName')} />
          </FormField>
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isDirty}>
            Salvar nome
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

export function FeaturedCompetitionCard() {
  const api = useApi();
  const queryClient = useQueryClient();
  const options = useQuery({
    queryKey: ['admin-featured'],
    queryFn: ({ signal }) =>
      api.get<ApiResponse<CompetitionOption[]>>('/admin/featured-competition', {}, signal),
  });
  const current = options.data?.data.find((option) => option.isFeatured)?.id ?? '';
  const [selected, setSelected] = useState<string | null>(null);
  const value = selected ?? current;

  const save = useMutation({
    mutationFn: () =>
      api.send<ApiResponse<CompetitionOption[]>>('PUT', '/admin/featured-competition', {
        competitionId: value || null,
      }),
    onSuccess: async () => {
      toast.success('Destaque da HOME atualizado.');
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ['admin-featured'] });
    },
    onError: (error) => toast.error(messageFor(error)),
  });

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Competição em destaque</CardTitle>
          <CardDescription>
            Abre a HOME e define a classificação exibida. Só competições publicadas.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {options.isError ? (
          <Callout tone="danger" title={messageFor(options.error)} />
        ) : options.isPending ? (
          <Skeleton className="h-10" />
        ) : (
          <FormField label="Competição">
            <NativeSelect value={value} onChange={(event) => setSelected(event.target.value)}>
              <option value="">Nenhuma (a HOME mostra as competições em ordem)</option>
              {options.data.data.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} · {option.seasonName} · {COMPETITION_STATUS_LABELS[option.status]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
        )}
      </CardContent>
      <CardFooter>
        <Button
          variant="primary"
          loading={save.isPending}
          disabled={options.isPending || value === current}
          onClick={() => save.mutate()}
        >
          Salvar destaque
        </Button>
      </CardFooter>
    </Card>
  );
}

export function BannersCard() {
  const api = useApi();
  const [editing, setEditing] = useState<{ banner?: AdminBannerDto } | null>(null);
  const banners = useQuery({
    queryKey: ['admin-banners'],
    queryFn: ({ signal }) => api.get<ApiResponse<AdminBannerDto[]>>('/admin/banners', {}, signal),
  });

  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>Banners do topo da HOME</CardTitle>
          <CardDescription>
            Vale o banner ativo mais recente dentro do período de exibição.
          </CardDescription>
        </div>
        <Button size="sm" onClick={() => setEditing({})}>
          <Plus aria-hidden="true" />
          Novo banner
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        {banners.isError ? (
          <div className="p-5">
            <Callout tone="danger" title={messageFor(banners.error)} />
          </div>
        ) : banners.isPending ? (
          <div className="p-5">
            <Skeleton className="h-14" />
          </div>
        ) : banners.data.data.length === 0 ? (
          <EmptyState
            icon={ImageIcon}
            title="Nenhum banner"
            description="Sem banner, a HOME abre com a competição em destaque."
          />
        ) : (
          <ul className="divide-y divide-border">
            {banners.data.data.map((banner) => (
              <li
                key={banner.id}
                className="flex items-start justify-between gap-4 px-5 py-4 sm:px-6"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-fg">{banner.title}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.8125rem] text-fg-subtle">
                    {banner.isShowing ? (
                      <Badge tone="success" dot>
                        Na HOME agora
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        {banner.isActive ? 'Fora do período' : 'Inativo'}
                      </Badge>
                    )}
                    {banner.startsAt ? <span>de {formatDateTime(banner.startsAt)}</span> : null}
                    {banner.endsAt ? <span>até {formatDateTime(banner.endsAt)}</span> : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${banner.title}`}
                  onClick={() => setEditing({ banner })}
                >
                  <Pencil />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => (open ? undefined : setEditing(null))}
      >
        {editing ? (
          <BannerDialog
            key={editing.banner?.id ?? 'novo'}
            banner={editing.banner}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </Dialog>
    </Card>
  );
}

const BANNER_FIELDS = [
  'eyebrow',
  'title',
  'subtitle',
  'ctaLabel',
  'ctaHref',
  'startsAt',
  'endsAt',
] as const;

function BannerDialog({ banner, onClose }: { banner?: AdminBannerDto; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BannerInput, unknown, BannerData>({
    resolver: zodResolver(bannerInputSchema),
    defaultValues: {
      eyebrow: banner?.eyebrow ?? '',
      title: banner?.title ?? '',
      subtitle: banner?.subtitle ?? '',
      ctaLabel: banner?.ctaLabel ?? '',
      ctaHref: banner?.ctaHref ?? '',
      isActive: banner?.isActive ?? true,
      startsAt: banner?.startsAt ?? null,
      endsAt: banner?.endsAt ?? null,
    },
  });

  async function onSubmit(values: BannerData) {
    try {
      await (banner
        ? api.send('PUT', `/admin/banners/${banner.id}`, values)
        : api.send('POST', '/admin/banners', values));
      toast.success(banner ? 'Banner salvo.' : 'Banner criado.');
      await queryClient.invalidateQueries({ queryKey: ['admin-banners'] });
      onClose();
    } catch (error) {
      if (!applyFieldErrors(error, setError, BANNER_FIELDS)) {
        toast.error(messageFor(error));
      }
    }
  }

  const dateField = (name: 'startsAt' | 'endsAt') => (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <Input
          type="datetime-local"
          value={toDateTimeLocal(field.value ?? null)}
          onChange={(event) => field.onChange(fromDateTimeLocal(event.target.value))}
          onBlur={field.onBlur}
        />
      )}
    />
  );

  return (
    <DialogContent title={banner ? 'Editar banner' : 'Novo banner'} className="max-w-2xl">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
        <DialogBody className="grid gap-5 overflow-y-auto sm:grid-cols-2">
          <FormField label="Sobretítulo" hint="Opcional." error={errors.eyebrow?.message}>
            <Input {...register('eyebrow')} />
          </FormField>
          <FormField label="Título" error={errors.title?.message}>
            <Input autoFocus {...register('title')} />
          </FormField>
          <FormField
            label="Subtítulo"
            hint="Opcional."
            error={errors.subtitle?.message}
            className="sm:col-span-2"
          >
            <Input {...register('subtitle')} />
          </FormField>
          <FormField label="Texto do botão" hint="Opcional." error={errors.ctaLabel?.message}>
            <Input {...register('ctaLabel')} />
          </FormField>
          <FormField
            label="Destino do botão"
            hint="Caminho interno (/clubes) ou https://"
            error={errors.ctaHref?.message}
          >
            <Input spellCheck={false} {...register('ctaHref')} />
          </FormField>
          <FormField label="Início da exibição" hint="Opcional." error={errors.startsAt?.message}>
            {dateField('startsAt')}
          </FormField>
          <FormField label="Fim da exibição" hint="Opcional." error={errors.endsAt?.message}>
            {dateField('endsAt')}
          </FormField>
          <Controller
            control={control}
            name="isActive"
            render={({ field }) => (
              <div className="flex items-center gap-3 sm:col-span-2">
                <Checkbox
                  id="banner-active"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <label htmlFor="banner-active" className="text-sm text-fg">
                  Ativo
                </label>
              </div>
            )}
          />
        </DialogBody>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancelar</Button>
          </DialogClose>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            {banner ? 'Salvar' : 'Criar banner'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
