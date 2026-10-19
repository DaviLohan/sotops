'use client';

import { type UpdateProfileInput, updateProfileSchema } from '@efed/shared';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
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
import { Input } from '@/components/ui/input';
import { messageFor } from '@/lib/api/errors';
import { useApi, useSession } from '@/lib/auth/session-context';
import { applyFieldErrors } from '../auth/form-helpers';

export function ProfileForm() {
  const { account } = useSession();
  const api = useApi();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: { displayName: account.displayName },
  });

  async function onSubmit(values: UpdateProfileInput) {
    try {
      await api.send('PATCH', '/account/profile', values);
      reset(values);
      toast.success('Perfil atualizado.');
      // Recarrega os dados do servidor para refletir o novo nome em toda a interface.
      router.refresh();
    } catch (error) {
      if (!applyFieldErrors(error, setError, ['displayName'])) {
        toast.error(messageFor(error));
      }
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <div>
            <CardTitle>Identificação</CardTitle>
            <CardDescription>Como você aparece para os outros participantes.</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Nome de exibição"
            error={errors.displayName?.message}
            className="sm:col-span-2"
          >
            <Input autoComplete="nickname" {...register('displayName')} />
          </FormField>
          <FormField label="Nome de usuário" hint="Identificador fixo da sua conta.">
            <Input value={`@${account.username}`} readOnly />
          </FormField>
          <FormField label="E-mail" hint="Usado para entrar e recuperar a senha.">
            <Input value={account.email} readOnly />
          </FormField>
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isDirty}>
            Salvar alterações
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
