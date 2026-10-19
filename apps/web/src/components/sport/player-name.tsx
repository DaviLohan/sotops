import type { PublicPlayer } from '@efed/shared';
import { cn } from '@/lib/cn';
import { ClubBadge } from './club-badge';

/** Apelido do jogador com o emblema do clube, alinhado ao lado de dentro do confronto. */
export function PlayerName({
  player,
  align = 'left',
  size = 'md',
  className,
}: {
  player: PublicPlayer;
  align?: 'left' | 'right';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const badge = (
    <ClubBadge club={player.club} size={size === 'lg' ? 'lg' : size === 'sm' ? 'sm' : 'md'} />
  );
  return (
    <span
      className={cn(
        'flex min-w-0 items-center gap-2.5',
        align === 'right' ? 'flex-row-reverse text-right' : 'text-left',
        className,
      )}
    >
      {badge}
      <span className="min-w-0">
        <span
          className={cn(
            'type-display block truncate text-fg',
            size === 'lg' ? 'type-h3' : size === 'sm' ? 'text-base' : 'text-lg',
          )}
        >
          {player.nickname}
        </span>
        {size === 'lg' && player.club ? (
          <span className="type-caption block truncate text-fg-subtle">{player.club.name}</span>
        ) : null}
      </span>
    </span>
  );
}
