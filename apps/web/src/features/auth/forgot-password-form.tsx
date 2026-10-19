'use client';

import { type ForgotPasswordInput, forgotPasswordSchema } from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
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

export function ForgotPasswordForm() {
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
      await apiRequest('/auth/password/forgot', { method: 'POST', body: values });
      setSent(true);
    } catch (caught) {
      setFormError(messageFor(caught));
    }
  }

  return (
    <AuthCard
      title="Recuperar senha"
      description="Informe o e-mail da conta. Enviaremos um link para criar uma nova senha."
      footer={
        <Link href="/entrar" className="font-medium text-link hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <Callout tone="success" title="Pedido recebido">
          Se houver uma conta com este e-mail, o link de redefinição chega em instantes. Ele vale
          por 30 minutos.
        </Callout>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
          {formError ? <Callout tone="danger" title={formError} /> : null}
          <FormField label="E-mail" error={errors.email?.message}>
            <Input
              type="email"
              autoComplete="email"
              autoCapitalize="none"
              autoFocus
              {...register('email')}
            />
          </FormField>
          <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
            Enviar link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
