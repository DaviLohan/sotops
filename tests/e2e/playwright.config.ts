import { defineConfig, devices } from '@playwright/test';
import { API_PORT, apiEnv, MAIL_API_PORT, SMTP_PORT, WEB_PORT, WEB_URL } from './support/env.js';

const repoRoot = '../..';

/**
 * Pré-requisito: `pnpm build` (os testes rodam contra os builds de produção da API e do web)
 * e a infraestrutura de desenvolvimento no ar (`pnpm infra:up`).
 */
export default defineConfig({
  testDir: './specs',
  // Os cenários compartilham um banco e dependem de ordem (ex.: MFA do administrador).
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: WEB_URL,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: [
    {
      name: 'mail',
      command: 'node support/mail-sink.mjs',
      env: { SMTP_PORT: String(SMTP_PORT), MAIL_API_PORT: String(MAIL_API_PORT) },
      url: `http://127.0.0.1:${MAIL_API_PORT}`,
      reuseExistingServer: false,
    },
    {
      name: 'api',
      command:
        'node support/prepare-db.mjs && pnpm --filter @efed/api db:seed && pnpm --filter @efed/api start',
      cwd: '.',
      env: apiEnv,
      url: `http://127.0.0.1:${API_PORT}/api/health/ready`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      name: 'web',
      command: `pnpm --filter @efed/web exec next start --port ${WEB_PORT}`,
      cwd: repoRoot,
      env: { API_INTERNAL_URL: `http://127.0.0.1:${API_PORT}` },
      url: WEB_URL,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
