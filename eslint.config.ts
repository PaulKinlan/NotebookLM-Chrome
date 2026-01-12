import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import eslintComments from 'eslint-plugin-eslint-comments';
import stylistic from '@stylistic/eslint-plugin';
import barrelReExports from './eslint-rules/barrel-only-re-exports.ts';

export default [
  eslint.configs.recommended,
  {
    files: ['src/**/*.ts', 'src/**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: './tsconfig.json',
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        // Chrome extension APIs
        chrome: 'readonly',
        browser: 'readonly',
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        prompt: 'readonly',
        navigator: 'readonly',
        history: 'readonly',
        location: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        // Web APIs
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Event: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        FocusEvent: 'readonly',
        DragEvent: 'readonly',
        ClipboardEvent: 'readonly',
        crypto: 'readonly',
        // IndexedDB
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        IDBOpenDBRequest: 'readonly',
        IDBValidKey: 'readonly',
        IDBRequest: 'readonly',
        IDBObjectStore: 'readonly',
        IDBTransaction: 'readonly',
        IDBCursor: 'readonly',
        IDBIndex: 'readonly',
        IDBKeyRange: 'readonly',
        // DOM types
        Node: 'readonly',
        Element: 'readonly',
        HTMLElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLUListElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLLabelElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLSpanElement: 'readonly',
        HTMLAnchorElement: 'readonly',
        HTMLDialogElement: 'readonly',
        HTMLDetailsElement: 'readonly',
        HTMLHeadingElement: 'readonly',
        HTMLParagraphElement: 'readonly',
        HTMLImageElement: 'readonly',
        HTMLScriptElement: 'readonly',
        HTMLStyleElement: 'readonly',
        HTMLFormElement: 'readonly',
        HTMLLIElement: 'readonly',
        HTMLTableElement: 'readonly',
        HTMLIFrameElement: 'readonly',
        NodeListOf: 'readonly',
        MessageEvent: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      'eslint-comments': eslintComments,
      '@stylistic': stylistic,
      'foliolm': {
        rules: {
          'barrel-only-re-exports': barrelReExports,
        },
      },
    },
    rules: {
      ...tseslint.configs['recommended-type-checked'].rules,
      ...stylistic.configs.recommended.rules,
      // Disallow eslint-disable comments - code should be fixed, not suppressed
      'eslint-comments/no-use': ['error', { allow: [] }],
      // Disallow unused eslint-disable comments
      'eslint-comments/no-unused-disable': 'error',
      // Disallow type coercion
      'no-implicit-coercion': 'error',
      'no-eq-null': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      // Disallow unsafe type assertions (allows safe runtime-checked assertions)
      // Temporarily disabled due to TypeScript project issues with hybrid TSX/JS modules
      // '@typescript-eslint/no-unsafe-type-assertion': 'error',
      // Disallow non-null assertions (!)
      // '@typescript-eslint/no-non-null-assertion': 'error',
      // Disallow unnecessary type assertions
      // '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      // Disallow explicit any types
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Limit file length for AI code analysis (400 lines = ~12-16k tokens)
      'max-lines': ['warn', { max: 400, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Test files: Allow type assertions and other test-specific patterns
    files: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/test/setup.ts', 'src/sandbox/**/*.ts'],
    plugins: {
      '@typescript-eslint': tseslint,
      'eslint-comments': eslintComments,
      '@stylistic': stylistic,
    },
    rules: {
      ...tseslint.configs['recommended-type-checked'].rules,
      ...stylistic.configs.recommended.rules,
      // Allow type assertions in tests (needed for mocks)
      '@typescript-eslint/no-unsafe-type-assertion': 'off',
      '@typescript-eslint/no-unnecessary-type-assertion': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Allow namespaces for global declarations in test setup
      '@typescript-eslint/no-namespace': 'off',
      // Allow unused vars with underscore prefix
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Allow global directive for sandbox and other ESLint directives in tests
      'no-console': 'off',
      'eslint-comments/no-use': 'off',
    },
  },
  {
    // Apply barrel-only-re-exports rule only to sidepanel index files
    files: ['src/sidepanel/index.ts'],
    rules: {
      'foliolm/barrel-only-re-exports': 'error',
    },
  },
  {
    // Special configuration for index.tsx which has both TSX and imported module logic
    files: ['src/sidepanel/index.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: null, // Disable project service for this hybrid file
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      '@stylistic': stylistic,
    },
    rules: {
      ...tseslint.configs['recommended-type-checked'].rules,
      ...stylistic.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];
