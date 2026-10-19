import { cn } from '@/lib/cn';

/**
 * Marca original da federação: um escudo que abriga o círculo central e a linha do meio-campo.
 * Não reproduz nenhum elemento gráfico de terceiros.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 44" className={cn('h-9 w-auto shrink-0', className)} aria-hidden="true">
      <path
        d="M20 1.5 37 7v15.2c0 9.6-6.7 16.3-17 20.3C9.7 38.5 3 31.8 3 22.2V7L20 1.5Z"
        fill="var(--brand)"
        stroke="var(--accent)"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M3.5 21.5h33" stroke="var(--fg)" strokeWidth="1.6" opacity="0.9" />
      <circle
        cx="20"
        cy="21.5"
        r="6.5"
        fill="none"
        stroke="var(--fg)"
        strokeWidth="1.6"
        opacity="0.9"
      />
      <circle cx="20" cy="21.5" r="1.8" fill="var(--accent)" />
    </svg>
  );
}

interface LogoProps {
  className?: string;
  /** Oculta o nome em telas muito estreitas. */
  compact?: boolean;
}

export function Logo({ className, compact = false }: LogoProps) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark />
      <span className={cn('flex flex-col leading-none', compact ? 'max-sm:sr-only' : undefined)}>
        <span className="type-display text-[1.375rem] text-fg">Federação</span>
        <span className="type-eyebrow mt-1 text-accent">eFootball 1x1</span>
      </span>
    </span>
  );
}
