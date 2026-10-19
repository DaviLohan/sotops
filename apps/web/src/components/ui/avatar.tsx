import { cn } from '@/lib/cn';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

interface AvatarProps {
  name: string;
  /** Imagem enviada pelo jogador (servida pela API); sem ela, as iniciais. */
  src?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-9 text-[0.8125rem]',
  lg: 'size-14 text-lg',
  xl: 'size-24 text-3xl',
} as const;

/** Avatar do jogador: a imagem enviada ou, sem ela, as iniciais. */
export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  if (src) {
    return (
      // A imagem já chega reprocessada em 256×256 pela API; o otimizador do Next.js não ajuda aqui.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        aria-hidden="true"
        className={cn(
          'shrink-0 rounded-full bg-surface-raised object-cover ring-1 ring-white/10',
          SIZES[size],
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full bg-brand font-semibold text-brand-fg ring-1 ring-white/10',
        SIZES[size],
        className,
      )}
    >
      {initialsOf(name)}
    </span>
  );
}
