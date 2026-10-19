'use client';

import { Toaster as Sonner } from 'sonner';

/** Avisos temporários, no tema da federação. */
export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            '!rounded-lg !border !border-border-strong !bg-surface-raised !text-fg !shadow-overlay',
          description: '!text-fg-muted',
          error: '!border-danger/40',
          success: '!border-success/40',
        },
      }}
    />
  );
}
