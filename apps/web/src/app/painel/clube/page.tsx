import {
  type ApiResponse,
  type MyClubDto,
  type MyPlayerProfileDto,
  type PaginatedResponse,
  type PublicClubListItem,
  TRANSFER_STATUS_LABELS,
  type TransferDto,
} from '@efed/shared';
import { ArrowRight } from 'lucide-react';
import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { ClubBadge } from '@/components/sport/club-badge';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import {
  CancelTransferButton,
  ClubRequestActions,
  LeaveClubButton,
  TransferRequestForm,
} from '@/features/club/my-club-actions';
import { publicGet, serverGet } from '@/lib/api/server';
import { requireSession } from '@/lib/auth/guards';
import { formatDate } from '@/lib/format';
import { TRANSFER_STATUS_TONES } from '@/lib/labels';
import { civilDate } from '@/lib/portal';

export const metadata: Metadata = { title: 'Meu clube' };

function TransferLine({ transfer }: { transfer: TransferDto }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
      <span className="flex items-center gap-2 text-fg-muted">
        <ClubBadge club={transfer.fromClub} size="sm" />
        {transfer.fromClub?.name ?? 'Sem clube'}
      </span>
      <ArrowRight className="size-4 text-fg-subtle" aria-label="para" />
      <span className="flex items-center gap-2 font-medium text-fg">
        <ClubBadge club={transfer.toClub} size="sm" />
        {transfer.toClub.name}
      </span>
      <Badge tone={TRANSFER_STATUS_TONES[transfer.status]} dot>
        {TRANSFER_STATUS_LABELS[transfer.status]}
      </Badge>
    </div>
  );
}

export default async function MyClubPage() {
  const { account } = await requireSession();
  const isPlayer = account.permissions.includes('player_profile.manage');
  const { data: requests } = await serverGet<ApiResponse<TransferDto[]>>('/me/club-requests');

  const [profile, club, clubs] = isPlayer
    ? await Promise.all([
        serverGet<ApiResponse<MyPlayerProfileDto | null>>('/me/player-profile').then((r) => r.data),
        serverGet<ApiResponse<MyClubDto>>('/me/club').then((r) => r.data),
        // ponytail: lista única de até 100 clubes no seletor; trocar por busca quando passar disso.
        publicGet<PaginatedResponse<PublicClubListItem>>('/public/clubs?pageSize=100').then(
          (r) => r.data,
        ),
      ])
    : [null, null, []];

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow="Área do jogador"
        title="Meu clube"
        description="Seu vínculo atual, o histórico e os pedidos de transferência."
      />

      {requests.length > 0 ? (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Pedidos para o seu clube</CardTitle>
              <CardDescription>
                Como responsável, você decide primeiro. Aceitos, seguem para a federação.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y divide-border">
              {requests.map((transfer) => (
                <li
                  key={transfer.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-6"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={transfer.player.nickname} src={transfer.player.avatarUrl} />
                    <div className="min-w-0">
                      <Link
                        href={`/jogadores/${transfer.player.slug}` as Route}
                        className="font-medium text-fg hover:underline"
                      >
                        {transfer.player.nickname}
                      </Link>
                      <p className="text-[0.8125rem] text-fg-subtle">
                        Para {transfer.toClub.name} · {formatDate(transfer.createdAt)}
                      </p>
                      {transfer.note ? (
                        <p className="mt-1 text-sm text-fg-muted">“{transfer.note}”</p>
                      ) : null}
                    </div>
                  </div>
                  <ClubRequestActions transfer={transfer} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      {!isPlayer ? (
        <Callout tone="info" title="Sua conta não tem o papel de jogador">
          Vínculos com clubes são para quem disputa competições.
        </Callout>
      ) : !profile || !club ? (
        <Callout
          tone="info"
          title="Crie seu perfil de jogador primeiro"
          action={
            <Button asChild size="sm" variant="primary">
              <Link href="/painel/perfil">Criar perfil</Link>
            </Button>
          }
        >
          O clube é ligado ao seu perfil esportivo.
        </Callout>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Clube atual</CardTitle>
            </CardHeader>
            <CardContent>
              {club.current ? (
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <Link
                    href={`/clubes/${club.current.club.slug}` as Route}
                    className="flex items-center gap-4 hover:text-accent"
                  >
                    <ClubBadge club={club.current.club} size="lg" />
                    <div>
                      <p className="type-display type-h3 text-fg">{club.current.club.name}</p>
                      <p className="text-[0.8125rem] text-fg-subtle">
                        Desde {civilDate(club.current.startedOn)}
                      </p>
                    </div>
                  </Link>
                  {club.openTransfer ? null : <LeaveClubButton clubName={club.current.club.name} />}
                </div>
              ) : (
                <p className="text-sm text-fg-muted">
                  Você está sem clube. Pode disputar competições assim ou pedir para entrar em um.
                </p>
              )}
            </CardContent>
          </Card>

          {club.openTransfer ? (
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Pedido em andamento</CardTitle>
                  <CardDescription>
                    Enviado em {formatDate(club.openTransfer.createdAt)}.
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <TransferLine transfer={club.openTransfer} />
                <CancelTransferButton transferId={club.openTransfer.id} />
              </CardContent>
            </Card>
          ) : (
            <TransferRequestForm clubs={clubs} currentClubSlug={club.current?.club.slug ?? null} />
          )}

          {club.recentTransfers.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Pedidos anteriores</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {club.recentTransfers.map((transfer) => (
                    <li key={transfer.id} className="flex flex-col gap-1.5 px-5 py-4 sm:px-6">
                      <TransferLine transfer={transfer} />
                      {transfer.decisionReason ? (
                        <p className="text-[0.8125rem] text-fg-muted">
                          Motivo: {transfer.decisionReason}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}

          {club.history.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle>Clubes anteriores</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <ul className="divide-y divide-border">
                  {club.history.map((membership) => (
                    <li
                      key={`${membership.club.slug}-${membership.startedOn}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6"
                    >
                      <span className="flex items-center gap-3 text-fg">
                        <ClubBadge club={membership.club} size="sm" />
                        {membership.club.name}
                      </span>
                      <span className="text-[0.8125rem] text-fg-subtle">
                        {civilDate(membership.startedOn)} –{' '}
                        {membership.endedOn ? civilDate(membership.endedOn) : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
