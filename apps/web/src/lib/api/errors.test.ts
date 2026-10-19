import { describe, expect, it } from 'vitest';
import { ApiError, errorFromResponse, messageFor } from './errors';

function problemResponse(body: unknown, init: ResponseInit): Response {
  return new Response(JSON.stringify(body), init);
}

describe('errorFromResponse', () => {
  it('converte problem details em ApiError com erros de campo', async () => {
    const error = await errorFromResponse(
      problemResponse(
        {
          status: 400,
          code: 'VALIDATION_FAILED',
          title: 'Inválido',
          errors: [{ path: 'email', message: 'x' }],
        },
        { status: 400 },
      ),
    );
    expect(error).toBeInstanceOf(ApiError);
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(error.fieldErrors).toEqual([{ path: 'email', message: 'x' }]);
  });

  it('cai em um erro genérico quando o corpo não é um problem details', async () => {
    const error = await errorFromResponse(new Response('<html>502</html>', { status: 502 }));
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.status).toBe(502);
    expect(error.message).not.toContain('html');
  });
});

describe('messageFor', () => {
  it('traduz o bloqueio temporário em tempo de espera', async () => {
    const error = await errorFromResponse(
      problemResponse(
        { status: 429, code: 'ACCOUNT_LOCKED', title: 'Bloqueada' },
        { status: 429, headers: { 'Retry-After': '95' } },
      ),
    );
    expect(messageFor(error)).toBe('Muitas tentativas. Aguarde 2 minutos e tente de novo.');
  });

  it('prefere o detalhe ao título e nunca expõe erros inesperados', () => {
    expect(
      messageFor(
        new ApiError({ status: 403, code: 'FORBIDDEN', title: 'Título', detail: 'Detalhe' }),
      ),
    ).toBe('Detalhe');
    expect(messageFor(new TypeError('stack interno'))).not.toContain('stack interno');
  });
});
