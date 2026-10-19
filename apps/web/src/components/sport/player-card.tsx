import { GAME_PLATFORM_LABELS, type PublicPlayerListItem } from '@efed/shared';
import type { Route } from 'next';
import Link from 'next/link';
import { Avatar } from '@/components/ui/avatar';
import { countryName } from '@/lib/countries';
import { ClubBadge } from './club-badge';

/** Jogador em listas do portal: avatar, apelido, país, plataforma e clube atual. */
export function PlayerCard({ player, aside }: { player: PublicPlayerListItem; aside?: string }) {
  return (
    <Link
      href={`/jogadores/${player.slug}` as Route}
      className="group flex items-center gap-4 border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-raised"
    >
      <Avatar name={player.nickname} src={player.avatarUrl} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="type-display type-h3 truncate text-fg group-hover:text-accent">
          {player.nickname}
        </p>
        <p className="type-caption mt-0.5 truncate text-fg-subtle">
          {countryName(player.country)} · {GAME_PLATFORM_LABELS[player.platform]}
        </p>
        <p className="type-small mt-2 flex items-center gap-2 truncate text-fg-muted">
          <ClubBadge club={player.club} size="sm" />
          {player.club ? player.club.name : 'Sem clube'}
        </p>
      </div>
      {aside ? <p className="type-caption shrink-0 text-fg-subtle">{aside}</p> : null}
    </Link>
  );
}
