import type { FormResult } from '@efed/shared';
import { cn } from '@/lib/cn';
import { FORM_LABELS, FORM_LETTERS } from '@/lib/portal';

const TONE: Record<FormResult, string> = {
  W: 'bg-success/90 text-canvas-deep',
  D: 'bg-fg-faint/50 text-fg',
  L: 'bg-danger/90 text-canvas-deep',
};

/** Últimos resultados (V, E, D). A letra acompanha a cor: a cor nunca é a única pista. */
export function FormDots({ form, className }: { form: FormResult[]; className?: string }) {
  if (form.length === 0) {
    return <span className="text-fg-faint">—</span>;
  }
  return (
    <span
      role="img"
      aria-label={`Últimos resultados: ${form.map((result) => FORM_LABELS[result]).join(', ')}`}
      className={cn('inline-flex gap-1', className)}
    >
      {form.map((result, index) => (
        <span
          // A posição é a identidade: a sequência é imutável e ordenada.
          key={index}
          aria-hidden="true"
          className={cn(
            'type-display flex size-[1.125rem] items-center justify-center text-[0.6875rem]',
            TONE[result],
          )}
        >
          {FORM_LETTERS[result]}
        </span>
      ))}
    </span>
  );
}
