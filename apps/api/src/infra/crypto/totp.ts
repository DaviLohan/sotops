import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * TOTP conforme RFC 6238 (HMAC-SHA1, 6 dígitos, passo de 30 s), o perfil aceito por
 * aplicativos autenticadores. Implementado sobre `node:crypto` e validado com os vetores
 * de teste das RFCs 4226 e 6238.
 */
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DIGITS = 6;
const STEP_SECONDS = 30;
/** Tolera um passo de defasagem de relógio para cada lado. */
const WINDOW = 1;

export function base32Encode(data: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of data) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) {
      throw new Error('Segredo Base32 inválido.');
    }
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function hotp(secret: Buffer, counter: bigint): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(counter);
  const digest = createHmac('sha1', secret).update(message).digest();
  const offset = digest[digest.length - 1]! & 0x0f;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

export function currentTotpStep(nowMs: number): bigint {
  return BigInt(Math.floor(nowMs / 1000 / STEP_SECONDS));
}

export function totpAt(secretBase32: string, nowMs: number): string {
  return hotp(base32Decode(secretBase32), currentTotpStep(nowMs));
}

/**
 * Confere o código dentro da janela de tolerância e devolve o passo de tempo que casou.
 * Passos já utilizados (`<= lastUsedStep`) são recusados para impedir o reuso do código.
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  nowMs: number,
  lastUsedStep: bigint | null,
): bigint | null {
  const secret = base32Decode(secretBase32);
  const current = currentTotpStep(nowMs);
  const candidate = Buffer.from(code);
  let matched: bigint | null = null;

  for (let offset = -WINDOW; offset <= WINDOW; offset += 1) {
    const step = current + BigInt(offset);
    if (step < 0n) {
      continue;
    }
    const expected = Buffer.from(hotp(secret, step));
    const equal = expected.length === candidate.length && timingSafeEqual(expected, candidate);
    if (equal && (lastUsedStep === null || step > lastUsedStep)) {
      matched = step;
    }
  }
  return matched;
}

export function buildOtpauthUri(issuer: string, account: string, secretBase32: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret: secretBase32,
    issuer,
    algorithm: 'SHA1',
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
