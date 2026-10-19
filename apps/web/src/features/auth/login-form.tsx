'use client';

import {
  type ApiResponse,
  type LoginInput,
  type LoginResultDto,
  loginSchema,
  recoveryCodeSchema,
  totpCodeSchema,
} from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, KeyRound } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { CodeInput } from '@/components/ui/code-input';
import { FormField } from '@/components/ui/form-field';
import { Input, PasswordInput } from '@/components/ui/input';
import { apiRequest } from '@/lib/api/client';
import { ApiError, messageFor } from '@/lib/api/errors';
import { navigateWithReload } from '@/lib/navigation';
import { AuthCard } from './auth-card';

interface LoginFormProps {
  /** Destino após o login, já validado como caminho interno. */
  nextPath: string;
  notice?: string;
}

export function LoginForm({ nextPath, notice }: LoginFormProps) {
  const [pendingCsrfToken, setPendingCsrfToken] = useState<string | null>(null);

  function finish() {
    navigateWithReload(nextPath);
  }

  if (pendingCsrfToken) {
    return (
      <MfaChallengeStep
        csrfToken={pendingCsrfToken}
        onSuccess={finish}
        onCancel={() => setPendingCsrfToken(null)}
      />
    );
  }
  return (
    <CredentialsStep notice={notice} onAuthenticated={finish} onMfaRequired={setPendingCsrfToken} />
  );
}

interface CredentialsStepProps {
  notice?: string;
  onAuthenticated: () => void;
  onMfaRequired: (csrfToken: string) => void;
}

function CredentialsStep({ notice, onAuthenticated, onMfaRequired }: CredentialsStepProps) {
  const [formError, setFormError] = useState<ApiError | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    try {
      const { data } = await apiRequest<ApiResponse<LoginResultDto>>('/auth/login', {
        method: 'POST',
        body: values,
      });
      if (data.status === 'MFA_REQUIRED') {
        onMfaRequired(data.csrfToken);
      } else {
        onAuthenticated();
      }
    } catch (error) {
      setFormError(error instanceof ApiError ? error : null);
      if (!(error instanceof ApiError)) {
        throw error;
      }
    }
  }

  return (
    <AuthCard
      title="Entrar"
      description="Acesse sua conta para acompanhar suas partidas e competições."
      footer={
        <p>
          Ainda não tem conta?{' '}
          <Link href="/cadastro" className="font-medium text-link hover:underline">
            Criar conta
          </Link>
        </p>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {notice && !formError ? <Callout tone="success">{notice}</Callout> : null}
        {formError ? (
          <Callout
            tone="danger"
            title={messageFor(formError)}
            action={
              formError.code === 'EMAIL_NOT_VERIFIED' ? (
                <Link href="/verificar-email" className="font-medium text-link hover:underline">
                  Reenviar o e-mail de confirmação
                </Link>
              ) : undefined
            }
          />
        ) : null}

        <FormField label="E-mail ou nome de usuário" error={errors.identifier?.message}>
          <Input
            autoComplete="username"
            autoCapitalize="none"
            autoFocus
            {...register('identifier')}
          />
        </FormField>

        <FormField
          label="Senha"
          error={errors.password?.message}
          labelAside={
            <Link
              href="/recuperar-senha"
              className="text-[0.8125rem] font-medium text-link hover:underline"
            >
              Esqueci a senha
            </Link>
          }
        >
          <PasswordInput autoComplete="current-password" {...register('password')} />
        </FormField>

        <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
          Entrar
        </Button>
      </form>
    </AuthCard>
  );
}

interface MfaChallengeStepProps {
  csrfToken: string;
  onSuccess: () => void;
  onCancel: () => void;
}

function MfaChallengeStep({ csrfToken, onSuccess, onCancel }: MfaChallengeStepProps) {
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed =
      mode === 'totp' ? totpCodeSchema.safeParse(value) : recoveryCodeSchema.safeParse(value);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Código inválido.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest('/auth/mfa/challenge', {
        method: 'POST',
        body: mode === 'totp' ? { code: parsed.data } : { recoveryCode: parsed.data },
        csrfToken,
      });
      onSuccess();
    } catch (caught) {
      setSubmitting(false);
      if (caught instanceof ApiError && caught.code === 'UNAUTHENTICATED') {
        // A sessão provisória expirou (10 minutos): é preciso informar a senha de novo.
        onCancel();
        return;
      }
      setError(messageFor(caught));
      setValue('');
    }
  }

  return (
    <AuthCard
      title="Verificação em duas etapas"
      description={
        mode === 'totp'
          ? 'Abra seu aplicativo autenticador e informe o código de 6 dígitos.'
          : 'Informe um dos códigos de recuperação que você guardou. Cada código funciona uma única vez.'
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        {mode === 'totp' ? (
          <FormField label="Código do autenticador" error={error ?? undefined}>
            <CodeInput
              autoFocus
              value={value}
              onChange={(event) => setValue(event.target.value.replace(/\D/g, ''))}
            />
          </FormField>
        ) : (
          <FormField
            label="Código de recuperação"
            error={error ?? undefined}
            hint="Formato: xxxxx-xxxxx"
          >
            <Input
              autoFocus
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
              value={value}
              onChange={(event) => setValue(event.target.value)}
            />
          </FormField>
        )}

        <Button type="submit" variant="primary" size="lg" loading={submitting}>
          Confirmar
        </Button>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button variant="link" onClick={onCancel}>
            <ArrowLeft aria-hidden="true" />
            Voltar
          </Button>
          <Button
            variant="link"
            onClick={() => {
              setMode(mode === 'totp' ? 'recovery' : 'totp');
              setValue('');
              setError(null);
            }}
          >
            <KeyRound aria-hidden="true" />
            {mode === 'totp' ? 'Usar código de recuperação' : 'Usar o aplicativo autenticador'}
          </Button>
        </div>
      </form>
    </AuthCard>
  );
}
