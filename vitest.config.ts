import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts', 'studio/test/api/**/*.test.ts'],
    testTimeout: 30000,
  },
});
