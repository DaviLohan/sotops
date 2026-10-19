import { expect, type Locator, type Page } from '@playwright/test';
import { SEED_PASSWORD } from './env.js';

/** Preenche e envia o login. Quem chama verifica o resultado (sucesso ou mensagem de erro). */
export async function signIn(
  page: Page,
  identifier: string,
  password = SEED_PASSWORD,
): Promise<void> {
  await page.goto('/entrar');
  await page.getByLabel('E-mail ou nome de usuário').fill(identifier);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar' }).click();
}

/** Alerta exibido no conteúdo da página (ignora o anunciador de rotas do Next.js). */
export function pageAlert(page: Page): Locator {
  return page.getByRole('main').getByRole('alert');
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Menu da conta/ }).click();
  await page.getByRole('menuitem', { name: 'Sair' }).click();
  await expect(page).toHaveURL('/');
}
