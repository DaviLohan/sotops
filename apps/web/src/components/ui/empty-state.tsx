import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="relative mb-5 flex size-14 items-center justify-center rounded-full border border-border-strong bg-surface-raised">
        {/* Círculo central do gramado, discreto, como assinatura visual dos estados vazios. */}
        <span
          className="absolute inset-[-10px] rounded-full border border-dashed border-border"
          aria-hidden="true"
        />
        <Icon className="size-6 text-fg-muted" aria-hidden="true" />
      </div>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      {description ? <p className="mt-1.5 max-w-sm text-sm text-fg-muted">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
