import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface StatCardProps {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  /** Linha de contexto abaixo do valor (variação, detalhe). */
  detail?: ReactNode;
  /** Destaca o indicador quando ele pede atenção. */
  tone?: 'default' | 'warning' | 'danger';
  className?: string;
}

const TONE_CLASSES = {
  default: 'text-fg-subtle',
  warning: 'text-warning',
  danger: 'text-danger',
} as const;

export function StatCard({
  label,
  value,
  icon: Icon,
  detail,
  tone = 'default',
  className,
}: StatCardProps) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('rounded-xl border border-border bg-surface p-5 shadow-raised', className)}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="type-eyebrow text-fg-subtle">{label}</p>
        <Icon className={cn('size-4', TONE_CLASSES[tone])} aria-hidden="true" />
      </div>
      <p className="type-display tabular mt-3 text-[2.5rem] text-fg">{value}</p>
      {detail ? <p className="mt-2 text-[0.8125rem] text-fg-muted">{detail}</p> : null}
    </div>
  );
}
