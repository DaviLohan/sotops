'use client';

import { type ForgotPasswordInput, forgotPasswordSchema } from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { CircleCheckBig } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { apiRequest } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { AuthCard } from './auth-card';

/**
 * A confirmação exige um clique: abrir o link não basta. Assim, verificadores automáticos de
 * e-mail que visitam o endereço não consomem o token.
 */
export function VerifyEmailPanel({ token }: { token: string | null }) {
  const [state, setState] = useState<'idle' | 'verifying' | 'verified'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function verify() {
    setState('verifying');
    setError(null);
    try {
      await apiRequest('/auth/verify-email', { method: 'POST', body: { token } });
      setState('verified');
    } catch (caught) {
      setState('idle');
      setError(messageFor(caught));
    }
  }

  if (state === 'verified') {
    return (
      <AuthCard title="E-mail confirmado" description="Sua conta está ativa. Agora é só entrar.">
        <div className="flex flex-col gap-5">
          <CircleCheckBig className="size-10 text-success" aria-hidden="true" />
          <Button asChild variant="primary" size="lg">
            <Link href="/entrar">Entrar</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (!token || error) {
    return <ResendForm problem={error ?? undefined} />;
  }

  return (
    <AuthCard title="Confirmar e-mail" description="Falta um clique para ativar a sua conta.">
      <Button
        variant="primary"
        size="lg"
        className="w-full"
        loading={state === 'verifying'}
        onClick={verify}
      >
        Confirmar meu e-mail
      </Button>
    </AuthCard>
  );
}

function ResendForm({ problem }: { problem?: string }) {
  const [sent, setSent] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  async function onSubmit(values: ForgotPasswordInput) {
    setFormError(null);
    try {
      await apiRequest('/auth/verify-email/resend', { method: 'POST', body: values });
      setSent(true);
    } catch (caught) {
      setFormError(messageFor(caught));
    }
  }

  return (
    <AuthCard
      title="Reenviar confirmação"
      description="Informe o e-mail do cadastro para receber um novo link."
      footer={
        <Link href="/entrar" className="font-medium text-link hover:underline">
          Voltar para o login
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {problem && !sent ? <Callout tone="danger" title={problem} /> : null}
        {formError ? <Callout tone="danger" title={formError} /> : null}
        {sent ? (
          <Callout tone="success" title="Pedido recebido">
            Se houver uma conta pendente com este e-mail, o novo link chega em instantes.
          </Callout>
        ) : null}
        <FormField label="E-mail" error={errors.email?.message}>
          <Input type="email" autoComplete="email" autoCapitalize="none" {...register('email')} />
        </FormField>
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
          Enviar novo link
        </Button>
      </form>
    </AuthCard>
  );
}
