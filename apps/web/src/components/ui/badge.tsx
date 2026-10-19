import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-raised text-fg-muted ring-border',
        brand: 'bg-brand-soft text-fg ring-brand-hover/50',
        accent: 'bg-accent-soft text-accent ring-accent/30',
        success: 'bg-success-soft text-success ring-success/25',
        warning: 'bg-warning-soft text-warning ring-warning/25',
        danger: 'bg-danger-soft text-danger ring-danger/25',
        info: 'bg-info-soft text-info ring-info/25',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeTone = NonNullable<VariantProps<typeof badgeVariants>['tone']>;

interface BadgeProps extends ComponentProps<'span'>, VariantProps<typeof badgeVariants> {
  /** Ponto colorido à esquerda, para estados. */
  dot?: boolean;
}

export function Badge({ className, tone, dot = false, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
