import type { PublicClub } from '@efed/shared';
import { cn } from '@/lib/cn';

const SIZES = { sm: 'h-6', md: 'h-8', lg: 'h-12', xl: 'h-16' } as const;

/**
 * Escudo do clube: a imagem enviada ou, sem ela, um emblema desenhado com as cores cadastradas.
 * As cores vêm do banco; o texto escolhe claro ou escuro pelo contraste com o fundo.
 */
export function ClubBadge({
  club,
  size = 'md',
  className,
}: {
  club:
    | (Pick<PublicClub, 'name' | 'tag' | 'primaryColor' | 'secondaryColor'> & {
        crestUrl?: string | null;
      })
    | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  if (!club) {
    return (
      <svg
        viewBox="0 0 40 44"
        className={cn('w-auto shrink-0', SIZES[size], className)}
        role="img"
        aria-label="Sem clube"
      >
        <path
          d="M20 2 37 7.5v14.7c0 9.2-6.4 15.7-17 19.6C9.4 37.9 3 31.4 3 22.2V7.5L20 2Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          className="text-fg-faint"
        />
      </svg>
    );
  }
  if (club.crestUrl) {
    return (
      // Já chega em WebP 256×256 da API; o otimizador do Next.js não acrescenta nada.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={club.crestUrl}
        alt={club.name}
        className={cn('aspect-square w-auto shrink-0 object-contain', SIZES[size], className)}
      />
    );
  }
  return (
    <svg
      viewBox="0 0 40 44"
      className={cn('w-auto shrink-0', SIZES[size], className)}
      role="img"
      aria-label={club.name}
    >
      <path
        d="M20 2 37 7.5v14.7c0 9.2-6.4 15.7-17 19.6C9.4 37.9 3 31.4 3 22.2V7.5L20 2Z"
        fill={club.primaryColor}
        stroke={club.secondaryColor}
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M3 23h34" stroke={club.secondaryColor} strokeWidth="1" opacity="0.55" />
      <text
        x="20"
        y="19"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontWeight="700"
        fontSize={club.tag.length > 3 ? 10 : 12}
        fill={readableOn(club.primaryColor)}
      >
        {club.tag}
      </text>
    </svg>
  );
}

/** Claro sobre fundo escuro e escuro sobre fundo claro (luminância relativa WCAG). */
function readableOn(hex: string): string {
  const channel = (start: number) => {
    const value = Number.parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return luminance > 0.35 ? 'var(--accent-fg)' : 'var(--fg)';
}
