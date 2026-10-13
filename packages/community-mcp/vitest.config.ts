import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: false,
    maxWorkers: 1,
    testTimeout: 20000,
  },
});
