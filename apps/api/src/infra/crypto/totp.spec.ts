import { describe, expect, it } from 'vitest';
import {
  base32Decode,
  base32Encode,
  buildOtpauthUri,
  currentTotpStep,
  generateTotpSecret,
  hotp,
  totpAt,
  verifyTotp,
} from './totp.js';

const RFC_SECRET = Buffer.from('12345678901234567890', 'ascii');

describe('HOTP/TOTP', () => {
  it('reproduz os vetores de teste da RFC 4226', () => {
    const expected = [
      '755224',
      '287082',
      '359152',
      '969429',
      '338314',
      '254676',
      '287922',
      '162583',
      '399871',
      '520489',
    ];
    expect(expected.map((_code, counter) => hotp(RFC_SECRET, BigInt(counter)))).toEqual(expected);
  });

  it('reproduz os vetores SHA-1 da RFC 6238 (truncados para 6 dígitos)', () => {
    const secret = base32Encode(RFC_SECRET);
    const vectors: [number, string][] = [
      [59, '287082'],
      [1111111109, '081804'],
      [1111111111, '050471'],
      [1234567890, '005924'],
      [2000000000, '279037'],
      [20000000000, '353130'],
    ];
    for (const [seconds, code] of vectors) {
      expect(totpAt(secret, seconds * 1000)).toBe(code);
    }
  });

  it('codifica e decodifica Base32 sem perdas (RFC 4648)', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
    expect(base32Decode('mzxw 6ytb oi==').toString()).toBe('foobar');
    expect(() => base32Decode('inválido!')).toThrow();
  });

  it('gera segredos de 160 bits', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Decode(secret)).toHaveLength(20);
  });

  it('aceita um passo de defasagem para cada lado e nada além disso', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const step = currentTotpStep(now);

    expect(verifyTotp(secret, totpAt(secret, now), now, null)).toBe(step);
    expect(verifyTotp(secret, totpAt(secret, now - 30_000), now, null)).toBe(step - 1n);
    expect(verifyTotp(secret, totpAt(secret, now + 30_000), now, null)).toBe(step + 1n);
    expect(verifyTotp(secret, totpAt(secret, now - 90_000), now, null)).toBeNull();
    expect(verifyTotp(secret, totpAt(secret, now + 90_000), now, null)).toBeNull();
  });

  it('recusa códigos de passos já utilizados', () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const step = currentTotpStep(now);
    const code = totpAt(secret, now);

    expect(verifyTotp(secret, code, now, step)).toBeNull();
    expect(verifyTotp(secret, code, now, step - 1n)).toBe(step);
  });

  it('recusa códigos com formato inesperado', () => {
    const secret = generateTotpSecret();
    expect(verifyTotp(secret, '', Date.now(), null)).toBeNull();
    expect(verifyTotp(secret, '12345', Date.now(), null)).toBeNull();
    expect(verifyTotp(secret, '1234567', Date.now(), null)).toBeNull();
  });

  it('monta a URI otpauth com emissor e conta', () => {
    const uri = buildOtpauthUri('Federação eFootball', 'jogador@exemplo.com', 'MZXW6YTBOI');
    const url = new URL(uri);
    expect(url.protocol).toBe('otpauth:');
    expect(decodeURIComponent(url.pathname)).toContain('Federação eFootball:jogador@exemplo.com');
    expect(url.searchParams.get('secret')).toBe('MZXW6YTBOI');
    expect(url.searchParams.get('issuer')).toBe('Federação eFootball');
    expect(url.searchParams.get('digits')).toBe('6');
  });
});
