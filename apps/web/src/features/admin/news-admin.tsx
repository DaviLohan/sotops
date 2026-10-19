'use client';

import {
  type AdminNewsDto,
  type ApiResponse,
  type NewsInput,
  newsInputSchema,
  NEWS_STATUS_LABELS,
  NEWS_STATUSES,
  type NewsStatus,
  type PaginatedResponse,
} from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { Newspaper, Pencil, Plus, Search, Star } from 'lucide-react';
import { useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Badge, type BadgeTone } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card } from '@/components/ui/card';
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
import { Input, NativeSelect, Textarea } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { cn } from '@/lib/cn';
import { formatDateTime, fromDateTimeLocal, toDateTimeLocal } from '@/lib/format';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { applyFieldErrors } from '../auth/form-helpers';

const PAGE_SIZE = 20;
const STATUS_TONES: Record<NewsStatus, BadgeTone> = {
  DRAFT: 'neutral',
  SCHEDULED: 'info',
  PUBLISHED: 'success',
};

export function NewsAdmin() {
  const api = useApi();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{ id?: string } | null>(null);
  const debouncedSearch = useDebouncedValue(search.trim(), 300);
  const params = { page, pageSize: PAGE_SIZE, search: debouncedSearch, status };

  const list = useQuery({
    queryKey: ['admin-news', params],
    queryFn: ({ signal }) =>
      api.get<PaginatedResponse<AdminNewsDto>>('/admin/news', params, signal),
    placeholderData: keepPreviousData,
  });

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
            aria-label="Buscar notícias"
            placeholder="Buscar por título ou categoria"
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
          className="sm:w-44"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
        >
          <option value="">Todas as situações</option>
          {NEWS_STATUSES.map((value) => (
            <option key={value} value={value}>
              {NEWS_STATUS_LABELS[value]}
            </option>
          ))}
        </NativeSelect>
        <Button variant="primary" onClick={() => setEditing({})}>
          <Plus aria-hidden="true" />
          Nova notícia
        </Button>
      </div>

      {list.isError ? (
        <div className="p-5">
          <Callout
            tone="danger"
            title={messageFor(list.error)}
            action={
              <Button size="sm" onClick={() => list.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        </div>
      ) : list.isPending ? (
        <div className="flex flex-col gap-3 p-5" role="status" aria-label="Carregando notícias">
          {Array.from({ length: 4 }, (_unused, index) => (
            <Skeleton key={index} className="h-14" />
          ))}
        </div>
      ) : list.data.data.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={search || status ? 'Nenhuma notícia encontrada' : 'Nenhuma notícia ainda'}
          description={search || status ? 'Ajuste a busca ou o filtro.' : 'Escreva a primeira.'}
        />
      ) : (
        <>
          <ul className={cn('divide-y divide-border', list.isPlaceholderData && 'opacity-60')}>
            {list.data.data.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 p-4 sm:px-5">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-fg">
                    {item.isFeatured ? (
                      <Star className="size-4 shrink-0 text-accent" aria-label="Em destaque" />
                    ) : null}
                    <span className="truncate">{item.title}</span>
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[0.8125rem] text-fg-subtle">
                    <Badge tone={STATUS_TONES[item.status]} dot>
                      {NEWS_STATUS_LABELS[item.status]}
                    </Badge>
                    <span>{item.category}</span>
                    {item.publishedAt ? <span>· {formatDateTime(item.publishedAt)}</span> : null}
                    {item.status !== 'DRAFT' && !item.isLive ? (
                      <span>· ainda não visível</span>
                    ) : null}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Editar ${item.title}`}
                  onClick={() => setEditing({ id: item.id })}
                >
                  <Pencil />
                </Button>
              </li>
            ))}
          </ul>
          <Pagination
            meta={list.data.meta}
            onPageChange={setPage}
            itemLabel="notícias"
            disabled={list.isPlaceholderData}
          />
        </>
      )}

      <Dialog
        open={editing !== null}
        onOpenChange={(open) => (open ? undefined : setEditing(null))}
      >
        {editing ? (
          <NewsDialog key={editing.id ?? 'nova'} id={editing.id} onClose={() => setEditing(null)} />
        ) : null}
      </Dialog>
    </Card>
  );
}

/** A edição carrega o texto completo antes de abrir o formulário. */
function NewsDialog({ id, onClose }: { id?: string; onClose: () => void }) {
  const api = useApi();
  const current = useQuery({
    queryKey: ['admin-news-item', id],
    queryFn: ({ signal }) => api.get<ApiResponse<AdminNewsDto>>(`/admin/news/${id}`, {}, signal),
    enabled: Boolean(id),
  });

  if (id && !current.data) {
    return (
      <DialogContent title="Editar notícia">
        <DialogBody>
          {current.isError ? (
            <Callout tone="danger" title={messageFor(current.error)} />
          ) : (
            <Skeleton className="h-64" />
          )}
        </DialogBody>
      </DialogContent>
    );
  }
  return <NewsForm news={current.data?.data} onClose={onClose} />;
}

const FIELDS = ['title', 'summary', 'body', 'category', 'status', 'publishedAt'] as const;

function NewsForm({ news, onClose }: { news?: AdminNewsDto; onClose: () => void }) {
  const api = useApi();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NewsInput>({
    resolver: zodResolver(newsInputSchema),
    defaultValues: {
      title: news?.title ?? '',
      summary: news?.summary ?? '',
      body: news?.body ?? '',
      category: news?.category ?? '',
      status: news?.status ?? 'DRAFT',
      publishedAt: news?.publishedAt ?? null,
      isFeatured: news?.isFeatured ?? false,
    },
  });
  const status = useWatch({ control, name: 'status' });

  async function onSubmit(values: NewsInput) {
    try {
      await (news
        ? api.send('PUT', `/admin/news/${news.id}`, values)
        : api.send('POST', '/admin/news', values));
      toast.success(news ? 'Notícia salva.' : 'Notícia criada.');
      await queryClient.invalidateQueries({ queryKey: ['admin-news'] });
      await queryClient.invalidateQueries({ queryKey: ['admin-news-item'] });
      onClose();
    } catch (error) {
      if (!applyFieldErrors(error, setError, FIELDS)) {
        toast.error(messageFor(error));
      }
    }
  }

  return (
    <DialogContent
      title={news ? 'Editar notícia' : 'Nova notícia'}
      description="Não há exclusão: para tirar do ar, volte para rascunho."
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="contents">
        <DialogBody className="grid gap-5 overflow-y-auto sm:grid-cols-2">
          <FormField label="Título" error={errors.title?.message} className="sm:col-span-2">
            <Input autoFocus {...register('title')} />
          </FormField>
          <FormField
            label="Resumo"
            hint="Aparece nos cartões da HOME."
            error={errors.summary?.message}
            className="sm:col-span-2"
          >
            <Textarea rows={2} maxLength={300} {...register('summary')} />
          </FormField>
          <FormField label="Texto" error={errors.body?.message} className="sm:col-span-2">
            <Textarea rows={8} {...register('body')} />
          </FormField>
          <FormField label="Categoria" error={errors.category?.message}>
            <Input {...register('category')} />
          </FormField>
          <FormField label="Situação" error={errors.status?.message}>
            <NativeSelect {...register('status')}>
              {NEWS_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {NEWS_STATUS_LABELS[value]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            label="Publicação"
            hint={
              status === 'SCHEDULED'
                ? 'Obrigatória para agendar. Horário do seu navegador.'
                : 'Opcional. Sem data, vale o momento da publicação.'
            }
            error={errors.publishedAt?.message}
          >
            <Controller
              control={control}
              name="publishedAt"
              render={({ field }) => (
                <Input
                  type="datetime-local"
                  value={toDateTimeLocal(field.value)}
                  onChange={(event) => field.onChange(fromDateTimeLocal(event.target.value))}
                  onBlur={field.onBlur}
                />
              )}
            />
          </FormField>
          <Controller
            control={control}
            name="isFeatured"
            render={({ field }) => (
              <div className="flex items-center gap-3 self-end pb-2.5">
                <Checkbox
                  id="news-featured"
                  checked={field.value}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                />
                <label htmlFor="news-featured" className="text-sm text-fg">
                  Destaque na HOME
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
            {news ? 'Salvar' : 'Criar notícia'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
