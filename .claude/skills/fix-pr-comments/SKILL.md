---
name: fix-pr-comments
description: |
  Fix all comments from the GitHub pull request for the current branch.
  Fetches PR review comments and addresses each issue raised by reviewers.

  Triggers: When you want to address PR feedback, fix review comments, or resolve PR issues.

  Examples:
  - "Fix the PR comments" → fetches and fixes all outstanding review comments
  - "Address the review feedback" → same behavior
  - "Fix PR issues" → same behavior
allowed-tools:
  - Bash
  - Read
  - Edit
  - Write
  - Glob
  - Grep
  - TodoWrite
  - Task
user-invokable: true
---

# Fix PR Comments

You are a PR review comment resolver. Your job is to find and fix all outstanding review comments on the current pull request.

## Workflow

### Step 1: Identify the Current Branch and PR

Run these commands to get the current branch and find the associated PR:

```bash
# Get current branch name
git branch --show-current

# Get PR number and details for this branch
gh pr view --json number,title,url,reviewDecision,state
```

If there's no PR for the current branch, inform the user and stop.

### Step 2: Fetch All Review Comments

Get all review comments on the PR:

```bash
# Get all review comments (these are inline code comments)
gh api repos/{owner}/{repo}/pulls/{pr_number}/comments --jq '.[] | {id: .id, path: .path, line: .line, body: .body, user: .user.login, created_at: .created_at}'

# Get all PR review threads to see which are resolved
gh pr view {pr_number} --json reviewThreads
```

Also check for general PR comments:

```bash
# Get issue-style comments on the PR
gh api repos/{owner}/{repo}/issues/{pr_number}/comments --jq '.[] | {id: .id, body: .body, user: .user.login, created_at: .created_at}'
```

### Step 3: Create a Todo List

Use TodoWrite to create a task list with all the issues to fix:

1. Parse each comment to understand what needs to be fixed
2. Create a todo item for each actionable comment
3. Group related comments if they're about the same issue

Skip comments that are:
- Questions that have been answered
- Already resolved threads
- Pure discussion without action items
- Approval messages like "LGTM"

### Step 4: Fix Each Issue

For each comment:

1. Mark the todo as in_progress
2. Read the relevant file(s) mentioned in the comment
3. Understand the reviewer's concern
4. Make the necessary fix
5. Mark the todo as completed

### Step 5: Run Tests

After fixing all issues, run the project's test suite:

```bash
npm test
```

Fix any test failures that result from your changes.

### Step 6: Summary

After completing all fixes, provide a summary:
- List of comments addressed
- Files modified
- Any comments that couldn't be automatically fixed (require discussion)

## Important Notes

- **Read before editing**: Always read the file context before making changes
- **Preserve intent**: Make sure fixes align with the overall code style and architecture
- **Test everything**: Run tests after each significant change
- **Document lessons**: If a comment reveals a pattern issue, consider updating CLAUDE.md
- **Don't over-fix**: Only address what the reviewer asked for, don't refactor unrelated code

## Handling Ambiguous Comments

If a comment is unclear or could be interpreted multiple ways:
1. Look at the surrounding code context
2. Check if there are follow-up comments clarifying the issue
3. If still unclear, note it in the summary as needing human clarification

## Git Etiquette

- Create focused commits for each logical fix
- Use clear commit messages referencing the review comment
- Don't force push or rebase without user permission
