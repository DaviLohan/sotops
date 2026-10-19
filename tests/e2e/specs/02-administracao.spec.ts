import { expect, type Page, test } from '@playwright/test';
import { enrollMfa, pageAlert, signIn, signInWithMfa, signOut } from '../support/actions.js';

test.describe.configure({ mode: 'serial' });

test.describe('painel administrativo', () => {
  let totpSecret: string;

  test('nega o painel a quem não tem papel administrativo', async ({ page }) => {
    await signIn(page, 'jogador1');
    await expect(page).toHaveURL('/painel');
    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Acesso restrito' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
  });

  test('exige que o administrador ative o MFA antes de liberar o painel', async ({ page }) => {
    await signIn(page, 'superadmin');
    await expect(page).toHaveURL('/painel');
    await expect(
      page.getByText('Ative a verificação em duas etapas para administrar a federação'),
    ).toBeVisible();

    await page.goto('/admin');
    await expect(
      page.getByRole('heading', { name: 'Ative a verificação em duas etapas' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'Ativar agora' }).click();
    totpSecret = await enrollMfa(page);

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await signOut(page);
  });

  function signInAsSuperAdmin(page: Page): Promise<void> {
    return signInWithMfa(page, 'superadmin', totpSecret);
  }

  test('pede o segundo fator no login e recusa código incorreto', async ({ page }) => {
    await signIn(page, 'superadmin');
    await page.getByLabel('Código do autenticador').fill('000000');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(pageAlert(page)).toContainText('Código de verificação inválido.');

    // Sem o segundo fator, a sessão provisória não abre áreas protegidas.
    await page.goto('/painel');
    await expect(page).toHaveURL(/\/entrar/);
  });

  test('mostra indicadores reais e permite suspender e reativar uma conta', async ({ page }) => {
    await signInAsSuperAdmin(page);

    await page.goto('/admin');
    await expect(page.getByRole('group', { name: 'Usuários' })).toContainText(/\d+ ativos/);

    await page.getByRole('link', { name: 'Usuários' }).click();
    await page.getByLabel('Buscar usuários').fill('jogador2');
    const row = page.getByRole('row', { name: /Jogador Dois/ });
    await expect(row).toBeVisible();
    await expect(page.getByRole('row')).toHaveCount(2);

    await page.getByRole('button', { name: 'Ações para Jogador Dois' }).click();
    await page.getByRole('menuitem', { name: 'Suspender conta' }).click();
    await page.getByRole('button', { name: 'Suspender conta' }).click();
    await expect(page.getByText('Descreva o motivo com pelo menos 5 caracteres.')).toBeVisible();
    await page.getByLabel('Motivo').fill('Abandono reiterado de partidas');
    await page.getByRole('button', { name: 'Suspender conta' }).click();
    // O selo existe duas vezes no DOM (coluna no desktop, resumo no celular): vale o visível.
    await expect(row.getByText('Suspenso', { exact: true }).filter({ visible: true })).toHaveCount(
      1,
    );

    // A conta suspensa não consegue mais entrar.
    const suspended = await page.context().browser()!.newContext();
    const suspendedPage = await suspended.newPage();
    await signIn(suspendedPage, 'jogador2');
    await expect(pageAlert(suspendedPage)).toContainText('Esta conta está suspensa.');
    await suspended.close();

    // A decisão fica registrada na auditoria, com autor e motivo.
    await page.getByRole('link', { name: 'Auditoria' }).click();
    await page
      .getByLabel('Filtrar por tipo de evento')
      .selectOption({ label: 'Ações administrativas' });
    const event = page.getByRole('row', { name: /Situação da conta alterada/ }).first();
    await expect(event).toContainText('@superadmin');
    await event.getByRole('button', { name: 'Ver detalhes' }).click();
    await expect(page.getByText('Abandono reiterado de partidas')).toBeVisible();

    await page.getByRole('link', { name: 'Usuários' }).click();
    await page.getByLabel('Buscar usuários').fill('jogador2');
    await page.getByRole('button', { name: 'Ações para Jogador Dois' }).click();
    await page.getByRole('menuitem', { name: 'Reativar conta' }).click();
    await page.getByLabel('Motivo').fill('Suspensão cumprida');
    await page.getByRole('button', { name: 'Reativar conta' }).click();
    // O selo existe duas vezes no DOM (coluna no desktop, resumo no celular): vale o visível.
    await expect(row.getByText('Ativo', { exact: true }).filter({ visible: true })).toHaveCount(1);
  });
});
