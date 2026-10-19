import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * Carrega o `.env` da raiz do monorepositório quando ele existe (desenvolvimento local).
 * Variáveis já definidas no ambiente têm precedência; em produção e nos testes nada é lido
 * de arquivo.
 */
export function loadEnvFiles(): void {
  if (process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') {
    return;
  }
  const candidates = [path.resolve(here, '../../.env'), path.resolve(here, '../../../../.env')];
  for (const file of candidates) {
    if (existsSync(file)) {
      process.loadEnvFile(file);
    }
  }
}
