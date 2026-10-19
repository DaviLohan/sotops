'use client';

import { type RegisterInput, registerSchema } from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input, PasswordInput } from '@/components/ui/input';
import { apiRequest } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { AuthCard } from './auth-card';
import { applyFieldErrors } from './form-helpers';
import { ResendVerificationButton } from './resend-verification-button';

const FIELDS = ['email', 'username', 'displayName', 'password', 'acceptPrivacyNotice'] as const;

export function RegisterForm() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { acceptPrivacyNotice: false as unknown as true },
  });

  async function onSubmit(values: RegisterInput) {
    setFormError(null);
    try {
      await apiRequest('/auth/register', { method: 'POST', body: values });
      setSentTo(values.email);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'USERNAME_TAKEN') {
        setError('username', { type: 'server', message: 'Este nome de usuário já está em uso.' });
        return;
      }
      if (!applyFieldErrors(error, setError, FIELDS)) {
        setFormError(messageFor(error));
      }
    }
  }

  if (sentTo) {
    return (
      <AuthCard
        title="Confira seu e-mail"
        description={
          <>
            Se os dados estiverem corretos, enviamos um link de confirmação para{' '}
            <strong className="font-semibold text-fg">{sentTo}</strong>. O link vale por 24 horas.
          </>
        }
        footer={
          <p>
            Já confirmou?{' '}
            <Link href="/entrar" className="font-medium text-link hover:underline">
              Entrar
            </Link>
          </p>
        }
      >
        <div className="flex items-center gap-4 rounded-lg border border-border bg-surface p-5">
          <MailCheck className="size-8 shrink-0 text-accent" aria-hidden="true" />
          <div className="text-sm text-fg-muted">
            <p>Não chegou? Veja a caixa de spam ou peça um novo link.</p>
            <ResendVerificationButton email={sentTo} className="mt-2" />
          </div>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Criar conta"
      description="Leva um minuto. Você confirma o e-mail e já pode entrar."
      footer={
        <p>
          Já tem conta?{' '}
          <Link href="/entrar" className="font-medium text-link hover:underline">
            Entrar
          </Link>
        </p>
      }
    >
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

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Nome de usuário"
            error={errors.username?.message}
            hint="Letras minúsculas, números e _"
          >
            <Input
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              {...register('username')}
            />
          </FormField>
          <FormField
            label="Nome de exibição"
            error={errors.displayName?.message}
            hint="Como aparece nas tabelas"
          >
            <Input autoComplete="nickname" {...register('displayName')} />
          </FormField>
        </div>

        <FormField
          label="Senha"
          error={errors.password?.message}
          hint="Pelo menos 10 caracteres. Uma frase longa é melhor que símbolos."
        >
          <PasswordInput autoComplete="new-password" {...register('password')} />
        </FormField>

        <div>
          <div className="flex items-start gap-3">
            <Controller
              control={control}
              name="acceptPrivacyNotice"
              render={({ field }) => (
                <Checkbox
                  id="acceptPrivacyNotice"
                  checked={Boolean(field.value)}
                  onCheckedChange={(checked) => field.onChange(checked === true)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  aria-invalid={errors.acceptPrivacyNotice ? true : undefined}
                  aria-describedby={
                    errors.acceptPrivacyNotice ? 'acceptPrivacyNotice-error' : undefined
                  }
                  className="mt-0.5"
                />
              )}
            />
            <label htmlFor="acceptPrivacyNotice" className="text-sm text-fg-muted">
              Li e aceito o{' '}
              <Link
                href="/privacidade"
                target="_blank"
                className="font-medium text-link hover:underline"
              >
                Aviso de Privacidade
              </Link>
              .
            </label>
          </div>
          {errors.acceptPrivacyNotice ? (
            <p
              id="acceptPrivacyNotice-error"
              role="alert"
              className="mt-1.5 text-[0.8125rem] text-danger"
            >
              {errors.acceptPrivacyNotice.message}
            </p>
          ) : null}
        </div>

        <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
          Criar conta
        </Button>
      </form>
    </AuthCard>
  );
}
