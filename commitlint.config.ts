import type { UserConfig } from "@commitlint/types";
import { RuleConfigSeverity } from "@commitlint/types";

const config: UserConfig = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "type-enum": [
      RuleConfigSeverity.Error,
      "always",
      [
        "feat",     // New feature
        "fix",      // Bug fix
        "docs",     // Documentation changes
        "style",    // Code style changes (formatting, etc.)
        "refactor", // Code refactoring
        "perf",     // Performance improvements
        "test",     // Adding or updating tests
        "build",    // Build system changes
        "ci",       // CI/CD changes
        "chore",    // Other changes
        "revert",   // Revert a previous commit
      ],
    ],
    "scope-enum": [
      RuleConfigSeverity.Error,
      "always",
      [
        "agents",
        "background",
        "components",
        "content",
        "sidepanel",
        "types",
        "lib",
        "storage",
        "permissions",
        "ui",
        "extensions",
        "settings",
        "release", // For semantic-release automated version commits
        "commitlint", // For commitlint configuration changes
      ],
    ],
    "subject-case": [0], // Allow any case for subject
  },
};

export default config;
