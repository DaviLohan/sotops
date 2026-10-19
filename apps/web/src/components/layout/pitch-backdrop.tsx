import { cn } from '@/lib/cn';

/**
 * Fundo decorativo: linhas de um campo visto de cima sob uma luz azul de estádio.
 * Usado com parcimônia (hero e telas de acesso) para dar atmosfera sem competir com o conteúdo.
 */
interface PitchBackdropProps {
  className?: string;
  /** Desloca o campo para a direita, deixando a área do texto livre das linhas. */
  offset?: boolean;
}

export function PitchBackdrop({ className, offset = false }: PitchBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div className="absolute -top-1/3 left-1/2 h-[140%] w-[140%] -translate-x-1/2 bg-[radial-gradient(ellipse_at_top,rgb(23_45_145/0.55),transparent_62%)]" />
      <svg
        className={cn(
          'absolute top-1/2 h-[120%] min-w-[900px] -translate-y-1/2 text-white/[0.07]',
          // Com deslocamento, as linhas somem gradualmente sob a coluna de texto.
          offset
            ? 'left-1/2 -translate-x-1/2 lg:left-[78%] lg:[mask-image:linear-gradient(to_right,transparent_38%,black_62%)]'
            : 'left-1/2 -translate-x-1/2',
        )}
        viewBox="0 0 1200 760"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        preserveAspectRatio="xMidYMid slice"
      >
        <rect x="40" y="40" width="1120" height="680" rx="4" />
        <path d="M600 40v680" />
        <circle cx="600" cy="380" r="110" />
        <circle cx="600" cy="380" r="4" fill="currentColor" />
        <rect x="40" y="200" width="170" height="360" />
        <rect x="40" y="290" width="62" height="180" />
        <rect x="990" y="200" width="170" height="360" />
        <rect x="1098" y="290" width="62" height="180" />
        <path d="M210 310a90 90 0 0 1 0 140M990 310a90 90 0 0 0 0 140" />
      </svg>
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-canvas to-transparent" />
    </div>
  );
}
