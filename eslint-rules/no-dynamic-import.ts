/**
 * ESLint Rule: Ban dynamic imports
 *
 * Disallows `import()` expressions in favor of static imports.
 * Dynamic imports make code harder to analyze and can hide circular dependencies.
 */

import { Rule } from 'eslint'

const rule: Rule.RuleModule = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Disallow dynamic imports in favor of static imports',
    },
    schema: [],
    messages: {
      noDynamicImport: 'Use static imports instead of dynamic import(). Dynamic imports make code harder to analyze and can hide circular dependencies.',
    },
  },
  create(context) {
    return {
      ImportExpression(node: any) {
        context.report({
          node,
          messageId: 'noDynamicImport',
        })
      },
    }
  },
}

export default rule
