import { MATCH_STATUS_LABELS, type MatchStatus } from '@efed/shared';
import { cn } from '@/lib/cn';
import { matchStatusTone } from '@/lib/portal';

const TONE = {
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-danger',
  neutral: 'text-fg-muted',
} as const;

/** Estado da partida em texto, com ponto colorido. "Final" aparece sem destaque. */
export function MatchState({ status, className }: { status: MatchStatus; className?: string }) {
  const tone = matchStatusTone(status);
  return (
    <span
      className={cn(
        'type-eyebrow inline-flex items-center gap-1.5',
        status === 'HOMOLOGATED' ? 'text-fg-subtle' : TONE[tone],
        className,
      )}
    >
      {status !== 'HOMOLOGATED' && tone !== 'neutral' ? (
        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      ) : null}
      {MATCH_STATUS_LABELS[status]}
    </span>
  );
}
