import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    pool: 'vmThreads',
    include: [
      'backend/src/**/*.test.ts',
      'frontend/src/**/*.test.ts',
    ],
    resolve: {
      alias: {
        // Allow .js imports to resolve to .ts files (Node ESM pattern)
      },
    },
  },
});

