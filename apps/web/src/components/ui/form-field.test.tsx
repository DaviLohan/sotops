import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FormField } from './form-field';
import { Input } from './input';

describe('FormField', () => {
  it('liga o rótulo e a dica ao campo', () => {
    render(
      <FormField label="E-mail" hint="Usado para entrar.">
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAccessibleDescription('Usado para entrar.');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('anuncia o erro e marca o campo como inválido', () => {
    render(
      <FormField label="E-mail" hint="Usado para entrar." error="Informe um e-mail válido.">
        <Input />
      </FormField>,
    );
    const input = screen.getByLabelText('E-mail');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Informe um e-mail válido.');
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.');
    expect(screen.queryByText('Usado para entrar.')).not.toBeInTheDocument();
  });
});
