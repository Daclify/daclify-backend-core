import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/native/**', 'tests/providers/**', 'tests/integration/**'],
    passWithNoTests: false,
    maxWorkers: 1,
    testTimeout: 20000,
  },
});
