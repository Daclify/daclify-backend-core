import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/native/ballot-proof.qualification.ts'],
    passWithNoTests: false,
    testTimeout: 20000,
    fileParallelism: false,
  },
});
