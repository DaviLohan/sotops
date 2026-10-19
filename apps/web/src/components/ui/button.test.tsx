import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './button';

describe('Button', () => {
  it('não envia formulários por padrão', () => {
    render(<Button>Ação</Button>);
    expect(screen.getByRole('button', { name: 'Ação' })).toHaveAttribute('type', 'button');
  });

  it('bloqueia cliques e sinaliza ocupado enquanto carrega', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Salvar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Salvar' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('aplica a aparência a um link com asChild', () => {
    render(
      <Button asChild variant="primary">
        <a href="/cadastro">Criar conta</a>
      </Button>,
    );
    const link = screen.getByRole('link', { name: 'Criar conta' });
    expect(link).toHaveAttribute('href', '/cadastro');
    expect(link.className).toContain('bg-accent');
  });
});
