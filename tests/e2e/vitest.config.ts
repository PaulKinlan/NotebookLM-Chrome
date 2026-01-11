import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // E2E test configuration
    testTimeout: 30000,
    hookTimeout: 60000,
    isolate: false,
    pool: 'forks',
    maxThreads: 1,
    minThreads: 1,
    fileParallelism: false, // Run test files sequentially to avoid profile lock
    reporters: ['verbose'],
    globals: true,

    // File patterns
    include: ['**/*.e2e.test.ts'],
    exclude: ['node_modules', 'dist'],

    // Coverage (optional for E2E)
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      exclude: [
        'node_modules/',
        'dist/',
        'tests/',
        '**/*.e2e.test.ts',
        '**/setup.ts',
      ],
    },
  },
});
