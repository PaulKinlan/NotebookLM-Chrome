import { Rule } from 'eslint';

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Enforce test files use .type.test.ts or .type.test.tsx suffix (e.g., .unit.test.ts)',
    },
    messages: {
      invalidSuffix:
        'Test files must use .unit.test.ts, .integration.test.ts, or .e2e.test.ts suffix. Found: {{filename}}',
    },
    schema: [],
  },
  create(context) {
    const filename = context.physicalFilename;
    const source = context.sourceCode.getText();

    // Patterns that indicate this is a test file
    const testPatterns = [
      /\b(import\s+.*\s+from\s+['"]vitest|['"]@vitest|describe\s*\(|test\s*\(|it\s*\()/,
      /\b(expect\s*\(|beforeAll\s*\(|beforeEach\s*\(|afterAll\s*\(|afterEach\s*\()/,
    ];

    const looksLikeTest = testPatterns.some((pattern) => pattern.test(source));

    // Valid test file suffixes
    const validTestSuffix = /\.(unit|integration|e2e)\.test\.(ts|tsx)$/;

    // Old/invalid patterns we want to catch
    const invalidTestSuffix = /\.test\.(ts|tsx)$/;

    if (looksLikeTest) {
      if (invalidTestSuffix.test(filename) && !validTestSuffix.test(filename)) {
        return {
          Program() {
            context.report({
              loc: { line: 0, column: 0 },
              messageId: 'invalidSuffix',
              data: { filename: filename.split('/').pop() },
            });
          },
        };
      }
    }

    return {};
  },
};

export default rule;
