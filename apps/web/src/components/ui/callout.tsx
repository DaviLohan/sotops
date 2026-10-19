import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

const TONES = {
  info: { icon: Info, classes: 'border-info/25 bg-info-soft', iconClass: 'text-info' },
  success: {
    icon: CircleCheck,
    classes: 'border-success/25 bg-success-soft',
    iconClass: 'text-success',
  },
  warning: {
    icon: TriangleAlert,
    classes: 'border-warning/30 bg-warning-soft',
    iconClass: 'text-warning',
  },
  danger: {
    icon: CircleAlert,
    classes: 'border-danger/30 bg-danger-soft',
    iconClass: 'text-danger',
  },
} as const;

interface CalloutProps {
  tone?: keyof typeof TONES;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}

/** Mensagem contextual em destaque. Erros usam `role="alert"` para serem anunciados. */
export function Callout({ tone = 'info', title, children, action, className }: CalloutProps) {
  const { icon: Icon, classes, iconClass } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={cn('flex gap-3 rounded-lg border p-4 text-sm', classes, className)}
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', iconClass)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold text-fg">{title}</p> : null}
        {children ? (
          <div className={cn('text-fg-muted', title ? 'mt-1' : undefined)}>{children}</div>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}
