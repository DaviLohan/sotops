import type { ComponentProps } from 'react';
import { cn } from '@/lib/cn';
import { Input } from './input';

/**
 * Campo único para o código de 6 dígitos. Um só input (em vez de seis caixas) funciona melhor
 * com colar, preenchimento automático do sistema e leitores de tela.
 */
export function CodeInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  return (
    <Input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      placeholder="000000"
      className={cn(
        'h-12 text-center font-mono text-xl tracking-[0.5em] placeholder:tracking-[0.5em]',
        className,
      )}
      {...props}
    />
  );
}
