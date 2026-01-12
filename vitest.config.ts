import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts', './src/jsx-runtime/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    // Define test projects for different test types
    projects: [
      // Unit tests
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.unit.test.{ts,tsx}'],
        },
      },
      // Integration tests
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.integration.test.{ts,tsx}'],
          testTimeout: 10000,
          hookTimeout: 10000,
        },
      },
    ],
  },
});
