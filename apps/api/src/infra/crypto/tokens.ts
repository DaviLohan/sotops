import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Token opaco de 256 bits, seguro para URL e cookies. */
export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Tokens aleatórios de alta entropia dispensam hash lento: SHA-256 basta para que um
 * vazamento do banco não permita reutilizá-los.
 */
export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmacSha256(secret: string, value: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
