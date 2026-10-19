import { expect, test } from '@playwright/test';
import { signIn } from '../support/actions.js';
import { SEED_PASSWORD } from '../support/env.js';

test.describe('portal público — HOME', () => {
  test('mostra competições, resultados, classificação, ranking, números e notícias do banco', async ({
    page,
  }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('eFootball competitivo');
    await expect(page.getByRole('heading', { name: 'Competições', level: 2 })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Liga Principal', level: 3, exact: true }),
    ).toBeVisible();

    const standings = page.getByRole('table', {
      name: /Cinco primeiros colocados de Liga Principal/,
    });
    await expect(standings.getByRole('row')).toHaveCount(6); // cabeçalho + 5 linhas
    await expect(standings.getByRole('columnheader', { name: 'PTS' })).toBeVisible();

    const results = page.locator('#resultados');
    await expect(results.getByRole('listitem')).toHaveCount(6);
    await expect(results.getByText('Final').first()).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Destaques da temporada' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'A federação em números' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Calendário competitivo' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Últimas notícias' })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Sua história/ })).toBeVisible();
  });

  test('não expõe dados de conta nas respostas públicas', async ({ request }) => {
    const response = await request.get('/api/v1/public/home');
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).not.toContain('@seed.federacao.local');
    expect(body).not.toMatch(/"(email|username|passwordHash)"/);
  });

  test('troca o período dos próximos confrontos', async ({ page }) => {
    await page.goto('/');
    const agenda = page.locator('#partidas');
    await expect(agenda.getByRole('tab', { name: 'Hoje' })).toHaveAttribute(
      'aria-selected',
      'true',
    );

    await agenda.getByRole('tab', { name: 'Semana' }).click();
    await expect(agenda.getByRole('tab', { name: 'Semana' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    // A semana do seed sempre tem partidas marcadas à frente.
    await expect(agenda.getByRole('listitem').first()).toBeVisible();
  });

  test('o cabeçalho é transparente sobre o hero e ganha fundo ao rolar', async ({ page }) => {
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header).toHaveClass(/border-transparent/);
    await page.mouse.wheel(0, 900);
    await expect(header).toHaveClass(/bg-canvas-deep/);
  });

  test('no celular não rola para o lado e o menu leva às seções', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    // Expressão em texto: o projeto de testes não carrega os tipos do DOM.
    const overflow = await page.evaluate<number>(
      'document.documentElement.scrollWidth - document.documentElement.clientWidth',
    );
    expect(overflow).toBe(0);

    await page.getByRole('button', { name: 'Abrir menu' }).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('link', { name: 'Classificação' }).click();
    await expect(drawer).toBeHidden();
    await expect(page).toHaveURL(/#classificacao$/);
  });

  test('para quem já entrou, o destaque leva ao painel', async ({ page }) => {
    await signIn(page, 'jogador1', SEED_PASSWORD);
    await expect(page).toHaveURL('/painel');
    await page.goto('/');
    await expect(page.getByRole('link', { name: 'Abrir meu painel' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Criar minha conta' })).toHaveCount(0);
  });
});
