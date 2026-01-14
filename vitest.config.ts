import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'jsx-runtime/jsx-runtime': path.resolve(__dirname, './src/jsx-runtime.ts'),
      'jsx-runtime/jsx-dev-runtime': path.resolve(__dirname, './src/jsx-runtime.ts'),
    },
  },
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'jsx-runtime',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // Common setup for all tests
    setupFiles: ['./src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    // Define test projects for different test types
    projects: [
      // JSX Runtime tests - use custom setup
      {
        extends: true,
        test: {
          name: 'jsx-runtime',
          include: ['src/jsx-runtime/**/*.test.{ts,tsx}'],
          setupFiles: ['./src/jsx-runtime/test/setup.ts'],
        },
      },
      // Unit tests (excluding jsx-runtime which has its own setup)
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.unit.test.{ts,tsx}'],
          exclude: ['src/jsx-runtime/**/*.test.{ts,tsx}'],
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
