'use client';

import { passwordSchema } from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Callout } from '@/components/ui/callout';
import { FormField } from '@/components/ui/form-field';
import { PasswordInput } from '@/components/ui/input';
import { apiRequest } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { AuthCard } from './auth-card';

const formSchema = z
  .object({ password: passwordSchema, confirmation: z.string() })
  .refine((values) => values.password === values.confirmation, {
    path: ['confirmation'],
    message: 'As senhas não coincidem.',
  });
type FormValues = z.infer<typeof formSchema>;

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  async function onSubmit(values: FormValues) {
    setFormError(null);
    try {
      await apiRequest('/auth/password/reset', {
        method: 'POST',
        body: { token, password: values.password },
      });
      router.push('/entrar?aviso=senha-redefinida');
    } catch (caught) {
      setFormError(messageFor(caught));
    }
  }

  if (!token) {
    return (
      <AuthCard
        title="Link inválido"
        description="Este endereço não contém um pedido de redefinição."
      >
        <Button asChild variant="primary" size="lg" className="w-full">
          <Link href="/recuperar-senha">Pedir um novo link</Link>
        </Button>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Nova senha"
      description="Ao salvar, todas as sessões abertas da conta são encerradas."
    >
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {formError ? (
          <Callout
            tone="danger"
            title={formError}
            action={
              <Link href="/recuperar-senha" className="font-medium text-link hover:underline">
                Pedir um novo link
              </Link>
            }
          />
        ) : null}
        <FormField
          label="Nova senha"
          error={errors.password?.message}
          hint="Pelo menos 10 caracteres."
        >
          <PasswordInput autoComplete="new-password" autoFocus {...register('password')} />
        </FormField>
        <FormField label="Repita a nova senha" error={errors.confirmation?.message}>
          <PasswordInput autoComplete="new-password" {...register('confirmation')} />
        </FormField>
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting}>
          Salvar nova senha
        </Button>
      </form>
    </AuthCard>
  );
}
