import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/native/**', 'tests/providers/**', 'tests/integration/**'],
    passWithNoTests: false,
    testTimeout: 20000,
  },
});
