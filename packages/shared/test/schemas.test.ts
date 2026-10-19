import { describe, expect, it } from 'vitest';
import {
  listUsersQuerySchema,
  loginSchema,
  mfaChallengeSchema,
  registerSchema,
  setUserRolesSchema,
} from '../src/index.js';

const validRegistration = {
  email: '  Jogador@Exemplo.COM ',
  username: 'Camisa_10',
  displayName: '  Camisa Dez ',
  password: 'uma-senha-longa',
  acceptPrivacyNotice: true,
};

describe('registerSchema', () => {
  it('normaliza e-mail, nome de usuário e nome de exibição', () => {
    const parsed = registerSchema.parse(validRegistration);
    expect(parsed.email).toBe('jogador@exemplo.com');
    expect(parsed.username).toBe('camisa_10');
    expect(parsed.displayName).toBe('Camisa Dez');
  });

  it('rejeita senha curta, usuário inválido e aviso de privacidade não aceito', () => {
    const result = registerSchema.safeParse({
      ...validRegistration,
      username: 'nome com espaço',
      password: 'curta',
      acceptPrivacyNotice: false,
    });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((issue) => issue.path.join('.'));
    expect(paths).toEqual(expect.arrayContaining(['username', 'password', 'acceptPrivacyNotice']));
  });

  it('não altera a senha (sem trim)', () => {
    const parsed = registerSchema.parse({ ...validRegistration, password: '  com espaços  ' });
    expect(parsed.password).toBe('  com espaços  ');
  });
});

describe('loginSchema', () => {
  it('normaliza o identificador para minúsculas', () => {
    expect(loginSchema.parse({ identifier: ' ADMIN ', password: 'x' }).identifier).toBe('admin');
  });
});

describe('mfaChallengeSchema', () => {
  it('aceita código TOTP ou código de recuperação, nunca ambos', () => {
    expect(mfaChallengeSchema.safeParse({ code: '123456' }).success).toBe(true);
    expect(mfaChallengeSchema.safeParse({ recoveryCode: 'ABCDE-12345' }).success).toBe(true);
    expect(
      mfaChallengeSchema.safeParse({ code: '123456', recoveryCode: 'abcde-12345' }).success,
    ).toBe(false);
    expect(mfaChallengeSchema.safeParse({ code: '12345' }).success).toBe(false);
  });
});

describe('schemas administrativos', () => {
  it('aplica paginação padrão e limita o tamanho da página', () => {
    expect(listUsersQuerySchema.parse({})).toMatchObject({ page: 1, pageSize: 20 });
    expect(listUsersQuerySchema.safeParse({ pageSize: '500' }).success).toBe(false);
  });

  it('rejeita papéis duplicados ou lista vazia', () => {
    expect(setUserRolesSchema.safeParse({ roles: [] }).success).toBe(false);
    expect(setUserRolesSchema.safeParse({ roles: ['PLAYER', 'PLAYER'] }).success).toBe(false);
    expect(setUserRolesSchema.safeParse({ roles: ['PLAYER', 'REFEREE'] }).success).toBe(true);
  });
});
