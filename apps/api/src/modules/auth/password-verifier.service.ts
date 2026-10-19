import { Injectable } from '@nestjs/common';
import { AppError } from '../../common/errors/app-error.js';
import { hashPassword, verifyPassword } from '../../infra/crypto/password-hashing.js';
import { generateOpaqueToken } from '../../infra/crypto/tokens.js';
import { PrismaService } from '../../infra/prisma/prisma.service.js';

@Injectable()
export class PasswordVerifier {
  /** Hash descartável usado para igualar o tempo de resposta quando a conta não existe. */
  private readonly decoyHash = hashPassword(generateOpaqueToken());

  constructor(private readonly prisma: PrismaService) {}

  /** Executa uma verificação completa de Argon2id mesmo sem conta correspondente. */
  async burnTime(password: string): Promise<void> {
    await verifyPassword(await this.decoyHash, password);
  }

  /** Reautenticação para operações sensíveis feitas com a sessão já aberta. */
  async assertCurrentPassword(userId: string, password: string): Promise<void> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { passwordHash: true },
    });
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new AppError('INVALID_CREDENTIALS', { detail: 'A senha informada está incorreta.' });
    }
  }
}
