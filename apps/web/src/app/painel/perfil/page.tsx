import type { ApiResponse, MyPlayerProfileDto } from '@efed/shared';
import type { Metadata } from 'next';
import { Callout } from '@/components/ui/callout';
import { PageHeader } from '@/components/ui/page-header';
import { AvatarCard } from '@/features/player/avatar-card';
import { PlayerProfileForm } from '@/features/player/player-profile-form';
import { serverGet } from '@/lib/api/server';
import { requireSession } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'Perfil de jogador' };

export default async function PlayerProfilePage() {
  const { account } = await requireSession();
  if (!account.permissions.includes('player_profile.manage')) {
    return (
      <div className="flex max-w-3xl flex-col gap-8">
        <PageHeader eyebrow="Área do jogador" title="Perfil de jogador" />
        <Callout tone="info" title="Sua conta não tem o papel de jogador">
          O perfil esportivo é para quem disputa competições.
        </Callout>
      </div>
    );
  }
  const { data: profile } =
    await serverGet<ApiResponse<MyPlayerProfileDto | null>>('/me/player-profile');

  return (
    <div className="flex max-w-3xl flex-col gap-8">
      <PageHeader
        eyebrow="Área do jogador"
        title="Perfil de jogador"
        description={
          profile
            ? 'Seus dados de jogo, país e avatar.'
            : 'Complete seu perfil para disputar competições e aparecer no portal.'
        }
      />
      <PlayerProfileForm profile={profile} />
      {profile ? <AvatarCard profile={profile} /> : null}
    </div>
  );
}
