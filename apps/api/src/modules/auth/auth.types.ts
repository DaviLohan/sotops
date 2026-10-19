import type { Permission, RoleKey, UserStatus } from '@efed/shared';

/** Identidade resolvida pela SessionGuard e anexada à requisição. */
export interface AuthContext {
  sessionId: string;
  user: {
    id: string;
    email: string;
    username: string;
    displayName: string;
    status: UserStatus;
    createdAt: Date;
  };
  roles: RoleKey[];
  /** Vazio enquanto houver pendência de MFA (desafio ou cadastro obrigatório). */
  permissions: Permission[];
  mfaEnabled: boolean;
  /** A sessão ainda não apresentou o segundo fator. */
  mfaPending: boolean;
  /** O papel exige MFA e o usuário ainda não cadastrou o segundo fator. */
  mfaEnrollmentRequired: boolean;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace -- forma oficial de estender o Request do Express
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
