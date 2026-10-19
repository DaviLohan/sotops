import { COMPETITION_STATUS_LABELS, type CompetitionCard } from '@efed/shared';
import { cn } from '@/lib/cn';

const TONE: Record<CompetitionCard['status'], string> = {
  DRAFT: 'text-fg-muted',
  REGISTRATION_OPEN: 'text-accent',
  IN_PROGRESS: 'text-success',
  FINISHED: 'text-fg-subtle',
};

export function CompetitionStatus({
  status,
  className,
}: {
  status: CompetitionCard['status'];
  className?: string;
}) {
  return (
    <span className={cn('type-eyebrow inline-flex items-center gap-1.5', TONE[status], className)}>
      <span
        className={cn(
          'size-1.5 rounded-full bg-current',
          status === 'IN_PROGRESS' && 'animate-pulse',
        )}
        aria-hidden="true"
      />
      {COMPETITION_STATUS_LABELS[status]}
    </span>
  );
}
