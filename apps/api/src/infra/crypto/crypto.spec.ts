import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { hashPassword, passwordNeedsRehash, verifyPassword } from './password-hashing.js';
import { generateRecoveryCodes } from './recovery-codes.js';
import { openSecret, sealSecret } from './secret-box.js';
import { generateOpaqueToken, hmacSha256, safeEqual, sha256Hex } from './tokens.js';

describe('hash de senha', () => {
  it('usa Argon2id com os parâmetros configurados e sal aleatório', async () => {
    const first = await hashPassword('uma-senha-longa');
    const second = await hashPassword('uma-senha-longa');
    expect(first).toMatch(/^\$argon2id\$v=19\$/);
    const parameters = first.split('$')[3]?.split(',').sort();
    expect(parameters).toEqual(['m=19456', 'p=1', 't=2']);
    expect(first).not.toBe(second);
    expect(passwordNeedsRehash(first)).toBe(false);
  });

  it('verifica a senha correta e recusa a incorreta ou um hash malformado', async () => {
    const hash = await hashPassword('uma-senha-longa');
    expect(await verifyPassword(hash, 'uma-senha-longa')).toBe(true);
    expect(await verifyPassword(hash, 'outra-senha')).toBe(false);
    expect(await verifyPassword('nao-e-um-hash', 'uma-senha-longa')).toBe(false);
  });

  it('sinaliza hashes gerados com parâmetros mais fracos', () => {
    const weaker =
      '$argon2id$v=19$m=4096,t=1,p=1$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaGhhc2hoYXNoaGFzaGhhc2g';
    expect(passwordNeedsRehash(weaker)).toBe(true);
  });
});

describe('cifra de segredos em repouso', () => {
  const key = randomBytes(32);

  it('cifra e decifra preservando o conteúdo', () => {
    const sealed = sealSecret(key, 'JBSWY3DPEHPK3PXP', 'usuario-1');
    expect(sealed).not.toContain('JBSWY3DPEHPK3PXP');
    expect(openSecret(key, sealed, 'usuario-1')).toBe('JBSWY3DPEHPK3PXP');
  });

  it('produz textos cifrados diferentes a cada chamada', () => {
    expect(sealSecret(key, 'segredo', 'a')).not.toBe(sealSecret(key, 'segredo', 'a'));
  });

  it('falha com chave errada, contexto errado ou conteúdo adulterado', () => {
    const sealed = sealSecret(key, 'segredo', 'usuario-1');
    expect(() => openSecret(randomBytes(32), sealed, 'usuario-1')).toThrow();
    expect(() => openSecret(key, sealed, 'usuario-2')).toThrow();
    const parts = sealed.split('.');
    parts[3] = Buffer.from('adulterado').toString('base64url');
    expect(() => openSecret(key, parts.join('.'), 'usuario-1')).toThrow();
    expect(() => openSecret(key, 'formato-invalido', 'usuario-1')).toThrow();
  });
});

describe('tokens e códigos', () => {
  it('gera tokens opacos de 256 bits, únicos e seguros para URL', () => {
    const tokens = new Set(Array.from({ length: 200 }, generateOpaqueToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) {
      expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    }
  });

  it('calcula SHA-256 e HMAC determinísticos', () => {
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
    expect(hmacSha256('chave', 'valor')).toBe(hmacSha256('chave', 'valor'));
    expect(hmacSha256('chave', 'valor')).not.toBe(hmacSha256('outra', 'valor'));
  });

  it('compara em tempo constante sem falhar com tamanhos diferentes', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });

  it('gera dez códigos de recuperação únicos no formato esperado', () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    for (const code of codes) {
      expect(code).toMatch(/^[a-hj-km-np-z2-9]{5}-[a-hj-km-np-z2-9]{5}$/);
    }
  });
});
