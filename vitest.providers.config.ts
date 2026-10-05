import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/providers/**/*.test.ts'], passWithNoTests: false, testTimeout: 20000 },
});
