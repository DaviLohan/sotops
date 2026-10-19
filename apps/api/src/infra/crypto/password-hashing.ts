import argon2 from 'argon2';

/**
 * Argon2id com os parâmetros mínimos recomendados pela OWASP (19 MiB, 2 iterações, 1 via).
 * Os parâmetros ficam gravados no próprio hash; ao endurecê-los aqui, `needsRehash`
 * migra as senhas antigas no próximo login bem-sucedido.
 */
const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    // Hash malformado é tratado como senha incorreta, nunca como erro do servidor.
    return false;
  }
}

export function passwordNeedsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}
