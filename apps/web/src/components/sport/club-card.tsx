import type { PublicClubListItem } from '@efed/shared';
import type { Route } from 'next';
import Link from 'next/link';
import { ClubBadge } from './club-badge';

export function ClubCard({ club }: { club: PublicClubListItem }) {
  return (
    <Link
      href={`/clubes/${club.slug}` as Route}
      className="group flex items-center gap-4 border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-raised"
    >
      <ClubBadge club={club} size="lg" />
      <div className="min-w-0">
        <p className="type-display type-h3 truncate text-fg group-hover:text-accent">{club.name}</p>
        <p className="type-caption mt-0.5 text-fg-subtle">
          {club.tag} · {club.members === 1 ? '1 jogador' : `${club.members} jogadores`}
        </p>
      </div>
    </Link>
  );
}
