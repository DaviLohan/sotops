import { randomInt } from 'node:crypto';

/** Alfabeto sem caracteres ambíguos (0/o, 1/l/i). */
const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const GROUP_LENGTH = 5;
export const RECOVERY_CODE_COUNT = 10;

function randomGroup(): string {
  let group = '';
  for (let index = 0; index < GROUP_LENGTH; index += 1) {
    group += ALPHABET[randomInt(ALPHABET.length)];
  }
  return group;
}

/** Códigos no formato `xxxxx-xxxxx` (~49 bits de entropia cada). */
export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): string[] {
  const codes = new Set<string>();
  while (codes.size < count) {
    codes.add(`${randomGroup()}-${randomGroup()}`);
  }
  return [...codes];
}
