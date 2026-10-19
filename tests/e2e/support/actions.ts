import { expect, type Locator, type Page } from '@playwright/test';
import { SEED_PASSWORD } from './env.js';
import { totpCode } from './totp.js';

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

/**
 * Ativa a verificação em duas etapas da conta logada (a partir de /painel/seguranca) e devolve o
 * segredo, para os próximos logins do teste.
 */
export async function enrollMfa(page: Page): Promise<string> {
  await page.goto('/painel/seguranca');
  await page.getByRole('button', { name: 'Ativar verificação em duas etapas' }).click();
  await page.getByLabel('Sua senha atual').fill(SEED_PASSWORD);
  await page.getByRole('button', { name: 'Continuar' }).click();

  await expect(page.getByAltText('QR code para o aplicativo autenticador')).toBeVisible();
  const secret = (await page.getByTestId('totp-secret').innerText()).trim();
  await page.getByLabel('Código de 6 dígitos').fill(totpCode(secret));
  await page.getByRole('button', { name: 'Ativar', exact: true }).click();

  await expect(
    page.getByRole('list', { name: 'Códigos de recuperação' }).getByRole('listitem'),
  ).toHaveCount(10);
  await page.getByRole('button', { name: 'Guardei os códigos' }).click();
  return secret;
}

/** Login de conta com MFA. Usa o código do próximo intervalo, que nunca foi consumido. */
export async function signInWithMfa(page: Page, identifier: string, secret: string): Promise<void> {
  await signIn(page, identifier);
  await expect(page.getByRole('heading', { name: 'Verificação em duas etapas' })).toBeVisible();
  await page.getByLabel('Código do autenticador').fill(totpCode(secret, 1));
  await page.getByRole('button', { name: 'Confirmar' }).click();
  await expect(page).toHaveURL('/painel');
}
