import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.{test,spec}.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
    },
    testTimeout: 30000,
    globals: false,
    env: {
      // Minimal env vars to satisfy config validation during test imports
      TELEGRAM_BOT_TOKEN: 'test-token-123',
      ALLOWED_USER_IDS: '12345',
    },
  },
});
