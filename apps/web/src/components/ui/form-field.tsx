import { cloneElement, type ReactElement, type ReactNode, useId } from 'react';
import { cn } from '@/lib/cn';

interface FieldControlProps {
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

interface FormFieldProps {
  label: string;
  /** Texto de apoio exibido abaixo do campo. */
  hint?: ReactNode;
  error?: string;
  /** Conteúdo alinhado à direita do rótulo (ex.: link "Esqueci a senha"). */
  labelAside?: ReactNode;
  className?: string;
  children: ReactElement<FieldControlProps>;
}

/**
 * Liga rótulo, ajuda e mensagem de erro ao controle por id/aria, para que leitores de
 * tela anunciem o erro junto com o campo.
 */
export function FormField({ label, hint, error, labelAside, className, children }: FormFieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-[0.8125rem] font-medium text-fg">
          {label}
        </label>
        {labelAside}
      </div>
      {cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
      {hint && !error ? (
        <p id={hintId} className="text-[0.8125rem] text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
