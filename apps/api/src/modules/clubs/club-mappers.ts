import type { PublicClub } from '@efed/shared';
import type { Club } from '../../generated/prisma/client.js';
import { mediaUrl } from '../media/media.controller.js';

export function toPublicClub(club: Club): PublicClub {
  return {
    slug: club.slug,
    name: club.name,
    tag: club.tag,
    primaryColor: club.primaryColor,
    secondaryColor: club.secondaryColor,
    crestUrl: mediaUrl(club.crestKey),
  };
}
