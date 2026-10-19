'use client';

import type { ApiResponse, MessageDto, SessionDto } from '@efed/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Monitor, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { describeUserAgent, formatDateTime, formatRelative } from '@/lib/format';

export function SessionsCard() {
  const api = useApi();
  const queryClient = useQueryClient();

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: ({ signal }) =>
      api.get<ApiResponse<SessionDto[]>>('/auth/sessions', undefined, signal),
    select: (response) => response.data,
  });

  const revoke = useMutation({
    mutationFn: (sessionId: string) => api.send('DELETE', `/auth/sessions/${sessionId}`),
    onSuccess: () => toast.success('Sessão encerrada.'),
    onError: (error) => toast.error(messageFor(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const revokeOthers = useMutation({
    mutationFn: () => api.send<ApiResponse<MessageDto>>('DELETE', '/auth/sessions'),
    onSuccess: (response) => toast.success(response.data.message),
    onError: (error) => toast.error(messageFor(error)),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  });

  const hasOthers = sessions.data?.some((session) => !session.current) ?? false;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Sessões ativas</CardTitle>
          <CardDescription>Dispositivos em que sua conta está aberta agora.</CardDescription>
        </div>
        {hasOthers ? (
          <Button
            size="sm"
            variant="danger"
            loading={revokeOthers.isPending}
            onClick={() => revokeOthers.mutate()}
          >
            Encerrar as outras
          </Button>
        ) : null}
      </CardHeader>
      <CardContent>
        {sessions.isPending ? (
          <div className="flex flex-col gap-3" role="status" aria-label="Carregando sessões">
            <Skeleton className="h-14" />
            <Skeleton className="h-14" />
          </div>
        ) : sessions.isError ? (
          <Callout
            tone="danger"
            title={messageFor(sessions.error)}
            action={
              <Button size="sm" onClick={() => sessions.refetch()}>
                Tentar de novo
              </Button>
            }
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {sessions.data.map((session) => {
              const mobile = /Android|iPhone|iPad/.test(session.userAgent ?? '');
              const Icon = mobile ? Smartphone : Monitor;
              return (
                <li
                  key={session.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0"
                >
                  <Icon className="size-5 shrink-0 text-fg-subtle" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-fg">
                      {describeUserAgent(session.userAgent)}
                      {session.current ? <Badge tone="success">Esta sessão</Badge> : null}
                    </p>
                    <p className="mt-0.5 text-[0.8125rem] text-fg-subtle">
                      {session.ipAddress ?? 'IP desconhecido'} · ativa{' '}
                      {formatRelative(session.lastSeenAt)} · aberta em{' '}
                      {formatDateTime(session.createdAt)}
                    </p>
                  </div>
                  {session.current ? null : (
                    <Button
                      size="sm"
                      loading={revoke.isPending && revoke.variables === session.id}
                      onClick={() => revoke.mutate(session.id)}
                    >
                      Encerrar
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
