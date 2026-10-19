import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { applyFieldErrors, safeNextPath } from './form-helpers';

describe('safeNextPath', () => {
  it('aceita caminhos internos', () => {
    expect(safeNextPath('/admin/usuarios?page=2')).toBe('/admin/usuarios?page=2');
  });

  it('recusa destinos externos e volta ao padrão', () => {
    for (const hostile of [
      'https://malicioso.example',
      '//malicioso.example',
      '/\\malicioso.example',
      'javascript:alert(1)',
      '',
      null,
      undefined,
    ]) {
      expect(safeNextPath(hostile)).toBe('/painel');
    }
  });
});

describe('applyFieldErrors', () => {
  const problem = (errors: { path: string; message: string }[]) =>
    new ApiError({ status: 400, code: 'VALIDATION_FAILED', title: 'Inválido', errors });

  it('associa cada erro ao campo correspondente', () => {
    const setError = vi.fn();
    const applied = applyFieldErrors(
      problem([
        { path: 'email', message: 'E-mail inválido.' },
        { path: 'desconhecido', message: 'Ignorado.' },
      ]),
      setError,
      ['email', 'password'],
    );
    expect(applied).toBe(true);
    expect(setError).toHaveBeenCalledTimes(1);
    expect(setError).toHaveBeenCalledWith('email', { type: 'server', message: 'E-mail inválido.' });
  });

  it('informa quando nenhum erro pôde ser associado', () => {
    const setError = vi.fn();
    expect(applyFieldErrors(problem([]), setError, ['email'])).toBe(false);
    expect(applyFieldErrors(new Error('rede'), setError, ['email'])).toBe(false);
    expect(setError).not.toHaveBeenCalled();
  });
});
