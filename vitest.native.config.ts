import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/native/**/*.test.ts'],
    exclude: [
      'tests/native/module-completion.test.ts',
      'tests/native/module-upgrade-completion.test.ts',
    ],
    passWithNoTests: false,
    testTimeout: 20000,
    fileParallelism: false,
  },
});
