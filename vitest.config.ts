import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
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
          include: ['src/**/*.unit.{test,spec}.{ts,tsx}', 'src/**/*.{test,spec}.{ts,tsx}'],
          exclude: ['**/*.integration.{test,spec}.{ts,tsx}', '**/*.e2e.{test,spec}.{ts,tsx}'],
        },
      },
      // Integration tests
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['src/**/*.integration.{test,spec}.{ts,tsx}'],
          testTimeout: 10000,
          hookTimeout: 10000,
        },
      },
    ],
  },
});
