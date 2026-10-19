import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { Spinner } from './spinner';

const buttonVariants = cva(
  [
    'inline-flex shrink-0 items-center justify-center gap-2 rounded-md font-semibold whitespace-nowrap',
    'transition-[background-color,border-color,color,transform] duration-150 ease-out-quint',
    'active:translate-y-px disabled:pointer-events-none disabled:opacity-50',
    '[&_svg]:size-4 [&_svg]:shrink-0',
  ],
  {
    variants: {
      variant: {
        /* O amarelo é reservado à ação principal de cada tela. */
        primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
        brand: 'bg-brand text-brand-fg hover:bg-brand-hover',
        secondary: 'border border-border-strong bg-surface-raised text-fg hover:bg-surface-hover',
        ghost: 'text-fg-muted hover:bg-surface-raised hover:text-fg',
        danger: 'bg-danger-soft text-danger ring-1 ring-danger/30 ring-inset hover:bg-danger/20',
        link: 'h-auto rounded-sm p-0 font-medium text-link underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-[0.8125rem]',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-[0.9375rem]',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
);

export interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  /** Renderiza o filho (ex.: um Link) com a aparência de botão. */
  asChild?: boolean;
  /** Mostra o indicador de progresso e bloqueia novos cliques. */
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size }), className);
  if (asChild) {
    return (
      <Slot.Root className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button
      type={type ?? 'button'}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export { buttonVariants };
