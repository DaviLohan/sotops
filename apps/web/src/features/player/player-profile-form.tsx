'use client';

import {
  GAME_PLATFORM_LABELS,
  GAME_PLATFORMS,
  type MyPlayerProfileDto,
  type UpsertPlayerProfile,
  type UpsertPlayerProfileInput,
  upsertPlayerProfileSchema,
} from '@efed/shared';
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
import { Input, NativeSelect } from '@/components/ui/input';
import { ApiError, messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';
import { COUNTRY_OPTIONS } from '@/lib/countries';
import { applyFieldErrors } from '../auth/form-helpers';

const FIELDS = ['nickname', 'efootballId', 'platform', 'country', 'region'] as const;

export function PlayerProfileForm({ profile }: { profile: MyPlayerProfileDto | null }) {
  const api = useApi();
  const router = useRouter();
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<UpsertPlayerProfileInput, unknown, UpsertPlayerProfile>({
    resolver: zodResolver(upsertPlayerProfileSchema),
    defaultValues: {
      nickname: profile?.nickname ?? '',
      efootballId: profile?.efootballId ?? '',
      platform: profile?.platform,
      country: profile?.country ?? 'BR',
      region: profile?.region ?? '',
    },
  });

  async function onSubmit(values: UpsertPlayerProfile) {
    try {
      await api.send('PUT', '/me/player-profile', values);
      reset({ ...values, region: values.region ?? '' });
      toast.success(profile ? 'Perfil atualizado.' : 'Perfil criado.');
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'EFOOTBALL_ID_TAKEN') {
        setError('efootballId', { type: 'server', message: error.message });
        return;
      }
      if (!applyFieldErrors(error, setError, FIELDS)) {
        toast.error(messageFor(error));
      }
    }
  }

  return (
    <Card>
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <CardHeader>
          <div>
            <CardTitle>Identificação esportiva</CardTitle>
            <CardDescription>
              É assim que adversários e a federação encontram você no eFootball.
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Apelido"
            hint="Nome exibido no portal."
            error={errors.nickname?.message}
          >
            <Input autoComplete="nickname" {...register('nickname')} />
          </FormField>
          <FormField label="Plataforma" error={errors.platform?.message}>
            <NativeSelect defaultValue="" {...register('platform')}>
              <option value="" disabled>
                Selecione
              </option>
              {GAME_PLATFORMS.map((platform) => (
                <option key={platform} value={platform}>
                  {GAME_PLATFORM_LABELS[platform]}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            label="ID no eFootball"
            hint="O ID de usuário exibido no seu perfil dentro do jogo. Único por plataforma."
            error={errors.efootballId?.message}
            className="sm:col-span-2"
          >
            <Input autoComplete="off" spellCheck={false} {...register('efootballId')} />
          </FormField>
          <FormField label="País" error={errors.country?.message}>
            <NativeSelect {...register('country')}>
              {COUNTRY_OPTIONS.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.name}
                </option>
              ))}
            </NativeSelect>
          </FormField>
          <FormField
            label="Região"
            hint="Opcional. Estado, província ou cidade."
            error={errors.region?.message}
          >
            <Input autoComplete="address-level1" {...register('region')} />
          </FormField>
        </CardContent>
        <CardFooter>
          <Button type="submit" variant="primary" loading={isSubmitting} disabled={!isDirty}>
            {profile ? 'Salvar alterações' : 'Criar perfil'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
