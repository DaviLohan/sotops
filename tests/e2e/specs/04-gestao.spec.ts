import { expect, test } from '@playwright/test';
import { enrollMfa, signIn, signInWithMfa, signOut } from '../support/actions.js';

test.describe.configure({ mode: 'serial' });

/** PNG 1×1 válido: a API o decodifica e regrava em WebP 256×256. */
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('gestão: perfil, clubes e transferências', () => {
  test('o jogador cria o perfil, envia o avatar e ganha a página pública', async ({ page }) => {
    await signIn(page, 'jogador1');
    await expect(page).toHaveURL('/painel');
    await page.getByRole('link', { name: 'Perfil de jogador' }).first().click();

    await page.getByLabel('Apelido').fill('Camisa Dez');
    await page.getByLabel('Plataforma').selectOption('PLAYSTATION');
    await page.getByLabel('ID no eFootball').fill('CAMISA10-E2E');
    await page.getByLabel('País').selectOption('BR');
    await page.getByLabel('Região').fill('Bahia');
    await page.getByRole('button', { name: 'Criar perfil' }).click();
    await expect(page.getByText('Perfil criado.')).toBeVisible();

    await page
      .locator('#avatar-file')
      .setInputFiles({ name: 'eu.png', mimeType: 'image/png', buffer: TINY_PNG });
    await expect(page.getByText('Avatar atualizado.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Trocar imagem' })).toBeVisible();

    // Arquivo que não é imagem é recusado pela API, mesmo com extensão de imagem.
    await page.locator('#avatar-file').setInputFiles({
      name: 'falso.png',
      mimeType: 'image/png',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
    });
    await expect(page.getByText('Envie uma imagem PNG, JPEG ou WebP de até 2 MB.')).toBeVisible();

    await page.getByRole('link', { name: '/jogadores/jogador1' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Camisa Dez' })).toBeVisible();
    await expect(page.getByText('Brasil · Bahia · PlayStation')).toBeVisible();
    await expect(page.getByText('CAMISA10-E2E')).toHaveCount(0);
  });

  test('o portal lista jogadores e clubes e a busca do cabeçalho encontra os dois', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Principal' })
      .getByRole('link', { name: 'Jogadores' })
      .click();
    await expect(page.getByRole('heading', { level: 1, name: 'Jogadores' })).toBeVisible();
    await page.getByRole('searchbox', { name: 'Buscar jogadores', exact: true }).fill('Raposa');
    await page.getByRole('button', { name: 'Buscar', exact: true }).click();
    await expect(page).toHaveURL(/busca=Raposa/);
    await page.getByRole('link', { name: /Raposa/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Raposa' })).toBeVisible();

    await page.goto('/clubes');
    await page.getByRole('link', { name: /Tempestade FC/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Tempestade FC' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Elenco' })).toBeVisible();

    await page.getByRole('button', { name: 'Buscar jogadores e clubes' }).click();
    await page.getByRole('searchbox', { name: 'Buscar jogadores e clubes' }).fill('Corsá');
    await page.getByRole('link', { name: /Corsários do Norte/ }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Corsários do Norte' })).toBeVisible();
  });

  test('a transferência pedida pelo jogador e aprovada pela federação cria o vínculo', async ({
    page,
  }) => {
    await signIn(page, 'jogador1');
    await expect(page).toHaveURL('/painel');
    await page.goto('/painel/clube');
    await expect(page.getByText('Você está sem clube.')).toBeVisible();
    await page.getByLabel('Clube').selectOption({ label: 'Nebulosa EC (NEB)' });
    await page.getByLabel('Mensagem').fill('Quero defender a Nebulosa.');
    await page.getByRole('button', { name: 'Enviar pedido' }).click();
    await expect(page.getByRole('heading', { name: 'Pedido em andamento' })).toBeVisible();
    await expect(page.getByText('Aguardando a federação')).toBeVisible();
    await signOut(page);

    // A conta "admin" do seed ainda não tem MFA: ativa no primeiro acesso.
    await signIn(page, 'admin');
    await expect(page).toHaveURL('/painel');
    const secret = await enrollMfa(page);
    await signOut(page);
    await signInWithMfa(page, 'admin', secret);

    await page.goto('/admin');
    await page.getByRole('link', { name: 'Transferências' }).click();
    const request = page.getByRole('listitem').filter({ hasText: 'Camisa Dez' });
    await expect(request).toContainText('Nebulosa EC');
    await expect(request).toContainText('Quero defender a Nebulosa.');
    await request.getByRole('button', { name: 'Aprovar' }).click();
    await expect(page.getByText('Transferência de Camisa Dez aprovada.')).toBeVisible();
    await expect(page.getByText('Nenhum pedido nesta situação')).toBeVisible();
    await signOut(page);

    // O portal guarda as respostas públicas por até 15 s (publicGet): recarrega até atualizar.
    await expect(async () => {
      await page.goto('/jogadores/jogador1');
      await expect(
        page
          .getByRole('main')
          .getByRole('link', { name: /Nebulosa EC/ })
          .first(),
      ).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
    await expect(async () => {
      await page.goto('/clubes/nebulosa-ec');
      await expect(page.getByRole('link', { name: /Camisa Dez/ })).toBeVisible({ timeout: 1_000 });
    }).toPass({ timeout: 30_000 });
  });
});
