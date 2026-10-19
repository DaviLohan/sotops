'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';

interface ResendVerificationButtonProps {
  email: string;
  className?: string;
}

export function ResendVerificationButton({ email, className }: ResendVerificationButtonProps) {
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setState('sending');
    setError(null);
    try {
      await apiRequest('/auth/verify-email/resend', { method: 'POST', body: { email } });
      setState('sent');
    } catch (caught) {
      setState('idle');
      setError(messageFor(caught));
    }
  }

  if (state === 'sent') {
    return (
      <p role="status" className={className}>
        Pedido recebido. Se a conta estiver pendente, o novo link chega em instantes.
      </p>
    );
  }
  return (
    <div className={className}>
      <Button variant="link" onClick={resend} loading={state === 'sending'}>
        Enviar novo link
      </Button>
      {error ? (
        <p role="alert" className="mt-1 text-[0.8125rem] text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
