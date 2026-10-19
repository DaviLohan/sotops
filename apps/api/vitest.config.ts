import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.spec.ts', 'test/**/*.test.ts'],
    globalSetup: ['test/support/global-setup.ts'],
    setupFiles: ['test/support/test-env.ts'],
    // Os testes de integração compartilham um único banco: os arquivos rodam em série.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
});
