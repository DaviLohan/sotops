import sharp from 'sharp';
import { AppError } from '../../common/errors/app-error.js';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
export const IMAGE_CONTENT_TYPE = 'image/webp';

/** Lado do quadrado gerado. 256 px cobre o maior uso (perfil em tela de alta densidade). */
const OUTPUT_SIZE = 256;
/** Evita "bombas de descompressão": imagem pequena no disco e gigante na memória. */
const MAX_INPUT_PIXELS = 25_000_000;

function invalidImage(): AppError {
  return new AppError('VALIDATION_FAILED', {
    errors: [{ path: 'file', message: 'Envie uma imagem PNG, JPEG ou WebP de até 2 MB.' }],
  });
}

/** Formato pelos primeiros bytes, nunca pela extensão ou pelo tipo declarado pelo navegador. */
export function sniffImageFormat(data: Buffer): 'png' | 'jpeg' | 'webp' | null {
  if (data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return 'png';
  }
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) {
    return 'jpeg';
  }
  if (
    data.subarray(0, 4).toString('latin1') === 'RIFF' &&
    data.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'webp';
  }
  return null;
}

/**
 * Valida e reprocessa uma imagem enviada: decodifica de verdade, corrige a orientação, recorta
 * em quadrado e grava em WebP. O arquivo original nunca é armazenado, o que descarta metadados
 * (EXIF, localização GPS) e qualquer conteúdo escondido junto da imagem.
 *
 * `cover` recorta (avatar); `contain` encaixa com fundo transparente (escudo).
 */
export async function normalizeImage(
  data: Buffer | undefined,
  fit: 'cover' | 'contain',
): Promise<Buffer> {
  if (!data || data.length === 0 || data.length > MAX_IMAGE_BYTES) {
    throw invalidImage();
  }
  const format = sniffImageFormat(data);
  if (!format) {
    throw invalidImage();
  }
  try {
    const image = sharp(data, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error' });
    const { format: decoded } = await image.metadata();
    if (decoded !== format) {
      throw invalidImage();
    }
    return await image
      .rotate()
      .resize(OUTPUT_SIZE, OUTPUT_SIZE, {
        fit,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw invalidImage();
  }
}
