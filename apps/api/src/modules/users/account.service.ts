import type { AccountDto, UpdateProfileInput } from '@efed/shared';
import { Injectable } from '@nestjs/common';
import type { RequestContext } from '../../common/http/request-context.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import type { AuthContext } from '../auth/auth.types.js';

/** Operações do usuário sobre a própria conta. */
@Injectable()
export class AccountService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async updateProfile(
    auth: AuthContext,
    input: UpdateProfileInput,
    context: RequestContext,
  ): Promise<Pick<AccountDto, 'id' | 'displayName'>> {
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id: auth.user.id },
        data: { displayName: input.displayName },
        select: { id: true, displayName: true },
      });
      await this.audit.record(
        {
          action: 'account.profile.updated',
          actorUserId: auth.user.id,
          entityType: 'user',
          entityId: auth.user.id,
          metadata: { fields: ['displayName'] },
          context,
        },
        tx,
      );
      return user;
    });
  }
}
