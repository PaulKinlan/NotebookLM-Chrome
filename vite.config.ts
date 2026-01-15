import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  build: {
    outDir: 'dist',
    sourcemap: process.env.NODE_ENV === 'development',
    // Disable modulepreload polyfill - Chrome 66+ supports modulepreload natively
    // and this extension targets Chrome 140+
    modulePreload: false,
    chunkSizeWarningLimit: 1000, // kB - extensions load locally, so 1MB is acceptable
    rollupOptions: {
      output: {
        manualChunks: {
          // Split AI SDKs into a separate chunk
          'ai-sdk': [
            'ai',
            '@ai-sdk/anthropic',
            '@ai-sdk/openai',
            '@ai-sdk/google',
            '@ai-sdk/groq',
            '@ai-sdk/huggingface',
            '@ai-sdk/openai-compatible',
            '@openrouter/ai-sdk-provider',
            '@built-in-ai/core',
          ],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 5173,
    },
  },
});
