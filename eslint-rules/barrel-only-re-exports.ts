/**
 * Custom ESLint rule to enforce architectural convention:
 * - index.ts / index.tsx files (barrel files) must ONLY contain re-exports
 * - Other files must NOT contain re-exports (they should declare their own exports)
 *
 * Allowed in barrel files:
 * - export { x } from './file'
 * - export { x as y } from './file'
 * - export * from './file'
 * - export * as name from './file'
 * - export type { x } from './file'
 * - import type { x } from './file' (for type-only re-exports)
 *
 * Disallowed in barrel files:
 * - export const x = ... (direct exports)
 * - export function foo() {} (direct exports)
 * - export class Bar {} (direct exports)
 * - export default ... (default exports)
 * - Variable/function/type declarations
 *
 * Disallowed in non-barrel files:
 * - export { x } from './file' (re-exports from other modules)
 */

interface RuleModule {
  meta: {
    type: string;
    docs: { description: string };
    messages: Record<string, string>;
    schema: unknown[];
  };
  create: (context: RuleContext) => RuleListeners;
}

interface RuleContext {
  filename: string;
  report: (descriptor: ReportDescriptor) => void;
}

interface ReportDescriptor {
  node: { type: string };
  messageId: string;
}

interface RuleListeners {
  Program?: (node: { body: unknown[] }) => void;
  ExportNamedDeclaration?: (node: ExportNode) => void;
  ExportAllDeclaration?: (node: ExportNode) => void;
  ExportDefaultDeclaration?: (node: ExportNode) => void;
  ImportDeclaration?: (node: ImportNode) => void;
}

interface ExportNode {
  type: string;
  source: { type: string } | null;
}

interface ImportNode {
  type: string;
  importKind?: string;
}

const rule: RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description:
        'Enforce index.ts files only contain re-exports, and other files do not re-export',
    },
    messages: {
      noNewDeclarations:
        'Barrel files (index.ts/index.tsx) must only contain re-exports. Move this declaration to a separate file.',
      noReExports:
        'Re-exports (export from) are only allowed in barrel files (index.ts/index.tsx). Declare exports locally instead.',
    },
    schema: [],
  },
  create(context: RuleContext) {
    const filename = context.filename;
    const isBarrelFile = /\/index\.(ts|tsx|js|jsx)$/.test(filename);

    return {
      // For barrel files: check that all statements are allowed (re-exports only)
      Program(node: { body: unknown[] }) {
        if (!isBarrelFile) return;

        for (const statement of node.body) {
          const stmt = statement as { type: string };

          // Skip import/export declarations - handled by other visitors
          if (
            stmt.type === 'ImportDeclaration' ||
            stmt.type === 'ExportNamedDeclaration' ||
            stmt.type === 'ExportAllDeclaration' ||
            stmt.type === 'ExportDefaultDeclaration'
          ) {
            continue;
          }

          // Disallow any other statements (variables, functions, classes, etc.)
          context.report({
            node: stmt,
            messageId: 'noNewDeclarations',
          });
        }
      },

      // Check ExportNamedDeclaration
      ExportNamedDeclaration(node: ExportNode) {
        const hasSource = node.source !== null;

        if (isBarrelFile) {
          // Barrel file: only allow re-exports (with source)
          if (!hasSource) {
            // This is a direct export like: export const x = ... or export { x }
            context.report({ node, messageId: 'noNewDeclarations' });
          }
          // Has source - it's a re-export like export { x } from './file', allow it
        } else {
          // Non-barrel file: disallow re-exports
          if (hasSource) {
            context.report({ node, messageId: 'noReExports' });
          }
        }
      },

      // Check ExportAllDeclaration
      ExportAllDeclaration(node: ExportNode) {
        if (isBarrelFile) {
          // Barrel file: export * from './file' is allowed
          return;
        }
        // Non-barrel file: disallow re-exports
        context.report({ node, messageId: 'noReExports' });
      },

      // Check ExportDefaultDeclaration
      ExportDefaultDeclaration(node: ExportNode) {
        if (isBarrelFile) {
          // export default is not allowed in barrel files
          context.report({ node, messageId: 'noNewDeclarations' });
        }
      },

      // Check ImportDeclaration
      ImportDeclaration(node: ImportNode) {
        if (!isBarrelFile) return;

        // In barrel files, only allow type-only imports
        if (node.importKind !== 'type') {
          context.report({ node, messageId: 'noNewDeclarations' });
        }
      },
    };
  },
};

export default rule;
