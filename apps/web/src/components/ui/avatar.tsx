import { cn } from '@/lib/cn';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

interface AvatarProps {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 'size-8 text-xs',
  md: 'size-9 text-[0.8125rem]',
  lg: 'size-14 text-lg',
} as const;

/** Avatar com iniciais. (O envio de imagem de perfil chega na Fase 2.) */
export function Avatar({ name, size = 'md', className }: AvatarProps) {
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
