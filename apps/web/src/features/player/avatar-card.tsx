'use client';

import type { ApiResponse, MyPlayerProfileDto } from '@efed/shared';
import { ImageUp, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ApiError, messageFor } from '@/lib/api/errors';
import { useApi } from '@/lib/auth/session-context';

const MAX_BYTES = 2 * 1024 * 1024;

/** Envio do avatar. A API confere o conteúdo e regrava a imagem; aqui só se poupa o envio inútil. */
export function AvatarCard({ profile }: { profile: MyPlayerProfileDto }) {
  const api = useApi();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<'upload' | 'remove' | null>(null);

  async function upload(file: File) {
    if (file.size > MAX_BYTES) {
      toast.error('A imagem deve ter no máximo 2 MB.');
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setBusy('upload');
    try {
      await api.send<ApiResponse<MyPlayerProfileDto>>('POST', '/me/player-profile/avatar', form);
      toast.success('Avatar atualizado.');
      router.refresh();
    } catch (error) {
      const fieldError = error instanceof ApiError ? error.fieldErrors[0]?.message : undefined;
      toast.error(fieldError ?? messageFor(error));
    } finally {
      setBusy(null);
      if (input.current) {
        input.current.value = '';
      }
    }
  }

  async function remove() {
    setBusy('remove');
    try {
      await api.send('DELETE', '/me/player-profile/avatar');
      toast.success('Avatar removido.');
      router.refresh();
    } catch (error) {
      toast.error(messageFor(error));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Avatar</CardTitle>
          <CardDescription>
            PNG, JPEG ou WebP de até 2 MB. Recortamos em formato quadrado.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-5">
        <Avatar name={profile.nickname} src={profile.avatarUrl} size="xl" />
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            id="avatar-file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                void upload(file);
              }
            }}
          />
          <Button
            type="button"
            onClick={() => input.current?.click()}
            loading={busy === 'upload'}
            disabled={busy !== null}
          >
            <ImageUp aria-hidden="true" />
            {profile.avatarUrl ? 'Trocar imagem' : 'Enviar imagem'}
          </Button>
          {profile.avatarUrl ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void remove()}
              loading={busy === 'remove'}
              disabled={busy !== null}
            >
              <Trash2 aria-hidden="true" />
              Remover
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
