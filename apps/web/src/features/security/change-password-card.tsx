'use client';

import { passwordSchema } from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { FormField } from '@/components/ui/form-field';
import { PasswordInput } from '@/components/ui/input';
import { ApiError, messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { applyFieldErrors } from '../auth/form-helpers';

const formSchema = z
  .object({
    currentPassword: z.string().min(1, 'Informe a senha atual.'),
    newPassword: passwordSchema,
    confirmation: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmation, {
    path: ['confirmation'],
    message: 'As senhas não coincidem.',
  });
type FormValues = z.infer<typeof formSchema>;

export function ChangePasswordCard() {
  const api = useApi();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(formSchema) });

  async function onSubmit({ currentPassword, newPassword }: FormValues) {
    try {
      await api.send('POST', '/auth/password/change', { currentPassword, newPassword });
      reset();
      toast.success('Senha alterada. As outras sessões foram encerradas.');
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
    } catch (error) {
      if (error instanceof ApiError && error.code === 'INVALID_CREDENTIALS') {
        setError('currentPassword', { type: 'server', message: 'A senha atual está incorreta.' });
        return;
      }
      if (!applyFieldErrors(error, setError, ['currentPassword', 'newPassword'])) {
        toast.error(messageFor(error));
      }
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <div>
            <CardTitle>Senha</CardTitle>
            <CardDescription>
              Ao trocar a senha, as sessões abertas em outros dispositivos são encerradas.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Senha atual"
            error={errors.currentPassword?.message}
            className="sm:col-span-2"
          >
            <PasswordInput autoComplete="current-password" {...register('currentPassword')} />
          </FormField>
          <FormField
            label="Nova senha"
            error={errors.newPassword?.message}
            hint="Pelo menos 10 caracteres."
          >
            <PasswordInput autoComplete="new-password" {...register('newPassword')} />
          </FormField>
          <FormField label="Repita a nova senha" error={errors.confirmation?.message}>
            <PasswordInput autoComplete="new-password" {...register('confirmation')} />
          </FormField>
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="primary" loading={isSubmitting}>
            Alterar senha
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
