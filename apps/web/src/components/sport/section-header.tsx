import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Abertura de seção: sobretítulo, título condensado e, à direita, uma ação opcional. */
export function SectionHeader({
  id,
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-3', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="type-eyebrow flex items-center gap-2 text-accent">
            <span className="h-px w-6 bg-accent" aria-hidden="true" />
            {eyebrow}
          </p>
        ) : null}
        <h2 id={id} className="type-display type-h1 mt-2 text-fg">
          {title}
        </h2>
        {description ? (
          <p className="type-body mt-2 max-w-xl text-fg-muted">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
