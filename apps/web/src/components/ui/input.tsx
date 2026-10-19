'use client';

import { Eye, EyeOff } from 'lucide-react';
import { type ComponentProps, useState } from 'react';
import { cn } from '@/lib/cn';

const inputClasses = [
  'h-10 w-full rounded-md border border-border-strong bg-surface-sunken px-3 text-sm text-fg',
  'transition-[border-color,box-shadow] duration-150',
  'hover:border-fg-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/25',
  'disabled:cursor-not-allowed disabled:opacity-60',
  'aria-invalid:border-danger aria-invalid:focus-visible:ring-danger/25',
  'read-only:bg-surface read-only:text-fg-muted',
];

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(inputClasses, className)} {...props} />;
}

/** Campo de senha com botão para revelar o conteúdo. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        className={cn(inputClasses, 'pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-fg-subtle hover:text-fg"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(inputClasses, 'h-auto min-h-24 py-2.5 leading-relaxed', className)}
      {...props}
    />
  );
}

export function NativeSelect({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(inputClasses, 'select-chevron appearance-none pr-9 text-ellipsis', className)}
      {...props}
    >
      {children}
    </select>
  );
}
