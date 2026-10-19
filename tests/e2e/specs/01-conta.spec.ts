import { expect, test } from '@playwright/test';
import { pageAlert, signIn, signOut } from '../support/actions.js';
import { linkFromMail } from '../support/mailbox.js';

const account = {
  email: 'estreante@exemplo.test',
  username: 'estreante',
  displayName: 'Estreante da Silva',
  password: 'primeira-senha-longa',
  newPassword: 'segunda-senha-longa',
};

test.describe('conta do jogador', () => {
  test('leva o visitante ao login ao abrir uma área protegida', async ({ page }) => {
    await page.goto('/painel/seguranca');
    await expect(page).toHaveURL(/\/entrar\?next=%2Fpainel%2Fseguranca$/);
    await expect(page.getByRole('heading', { name: 'Entrar' })).toBeVisible();
  });

  test('valida o formulário de cadastro antes de enviar', async ({ page }) => {
    await page.goto('/cadastro');
    await page.getByRole('button', { name: 'Criar conta' }).click();

    await expect(page.getByText('Informe um e-mail válido.')).toBeVisible();
    await expect(page.getByText('A senha deve ter pelo menos 10 caracteres.')).toBeVisible();
    await expect(page.getByText('É necessário aceitar o Aviso de Privacidade.')).toBeVisible();
    await expect(page.getByLabel('E-mail')).toHaveAttribute('aria-invalid', 'true');
  });

  test('cadastra, confirma o e-mail pelo link recebido e entra', async ({ page }) => {
    await page.goto('/cadastro');
    await page.getByLabel('E-mail').fill(account.email);
    await page.getByLabel('Nome de usuário').fill(account.username);
    await page.getByLabel('Nome de exibição').fill(account.displayName);
    await page.getByLabel('Senha', { exact: true }).fill(account.password);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Criar conta' }).click();
    await expect(page.getByRole('heading', { name: 'Confira seu e-mail' })).toBeVisible();

    // Antes da confirmação, o login é recusado com uma orientação clara.
    await signIn(page, account.email, account.password);
    await expect(pageAlert(page)).toContainText('Confirme seu e-mail antes de entrar.');

    await page.goto(await linkFromMail(account.email, 'Confirme seu e-mail'));
    await page.getByRole('button', { name: 'Confirmar meu e-mail' }).click();
    await expect(page.getByRole('heading', { name: 'E-mail confirmado' })).toBeVisible();

    await signIn(page, account.username, account.password);
    await expect(page).toHaveURL('/painel');
    await expect(page.getByRole('heading', { name: `Olá, ${account.displayName}` })).toBeVisible();
  });

  test('recusa credenciais incorretas sem revelar se a conta existe', async ({ page }) => {
    await signIn(page, account.email, 'senha-incorreta');
    const knownAccount = await pageAlert(page).innerText();

    await signIn(page, 'ninguem@exemplo.test', 'senha-incorreta');
    await expect(pageAlert(page)).toHaveText(knownAccount);
    await expect(page).toHaveURL(/\/entrar/);
  });

  test('atualiza o nome de exibição e reflete a mudança no cabeçalho', async ({ page }) => {
    await signIn(page, account.email, account.password);
    await expect(page).toHaveURL('/painel');
    await page.goto('/painel/conta');
    await page.getByLabel('Nome de exibição').fill('Estreante FC');
    await page.getByRole('button', { name: 'Salvar alterações' }).click();

    await expect(page.getByText('Perfil atualizado.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu da conta de Estreante FC' })).toBeVisible();
  });

  test('redefine a senha pelo link do e-mail e encerra a sessão aberta', async ({
    page,
    browser,
  }) => {
    await signIn(page, account.email, account.password);
    await expect(page).toHaveURL('/painel');

    const visitor = await browser.newContext();
    const recovery = await visitor.newPage();
    await recovery.goto('/recuperar-senha');
    await recovery.getByLabel('E-mail').fill(account.email);
    await recovery.getByRole('button', { name: 'Enviar link' }).click();
    await expect(recovery.getByText('Pedido recebido')).toBeVisible();

    await recovery.goto(await linkFromMail(account.email, 'Redefinição de senha'));
    await recovery.getByLabel('Nova senha', { exact: true }).fill(account.newPassword);
    await recovery.getByLabel('Repita a nova senha').fill(account.newPassword);
    await recovery.getByRole('button', { name: 'Salvar nova senha' }).click();
    await expect(recovery.getByText('Senha redefinida. Entre com a nova senha.')).toBeVisible();
    await visitor.close();

    // A sessão que estava aberta deixa de valer.
    await page.goto('/painel');
    await expect(page).toHaveURL(/\/entrar/);

    await signIn(page, account.email, account.password);
    await expect(pageAlert(page)).toBeVisible();
    await signIn(page, account.email, account.newPassword);
    await expect(page).toHaveURL('/painel');
    await signOut(page);
  });
});
