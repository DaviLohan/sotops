import { Injectable } from '@nestjs/common';
import type { UserTokenType } from '../../generated/prisma/client.js';
import { generateOpaqueToken, sha256Hex } from '../../infra/crypto/tokens.js';
import { type DbClient, PrismaService } from '../../infra/prisma/prisma.service.js';

/** Tokens de uso único enviados por e-mail (verificação e redefinição de senha). */
@Injectable()
export class UserTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /** Emite um novo token e invalida os anteriores do mesmo tipo. */
  async issue(
    userId: string,
    type: UserTokenType,
    ttlMs: number,
    db: DbClient = this.prisma,
  ): Promise<string> {
    const token = generateOpaqueToken();
    const now = new Date();
    await db.userToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: now },
    });
    await db.userToken.create({
      data: {
        userId,
        type,
        tokenHash: sha256Hex(token),
        expiresAt: new Date(now.getTime() + ttlMs),
      },
    });
    return token;
  }

  /**
   * Consome o token de forma atômica: o UPDATE condicional garante que duas requisições
   * simultâneas com o mesmo token não sejam ambas aceitas.
   */
  async consume(token: string, type: UserTokenType, db: DbClient): Promise<string | null> {
    const tokenHash = sha256Hex(token);
    const now = new Date();
    const result = await db.userToken.updateMany({
      where: { tokenHash, type, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (result.count !== 1) {
      return null;
    }
    const record = await db.userToken.findUnique({
      where: { tokenHash },
      select: { userId: true },
    });
    return record?.userId ?? null;
  }
}
