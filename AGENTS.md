# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## MANDATORY: Documentation Updates Required for Every Change

**CRITICAL REQUIREMENT:** Every code change MUST include updates to the relevant documentation files. This is NOT optional. Before completing ANY task, you MUST review and update the following documentation:

### Required Documentation Files

| File | When to Update |
|------|----------------|
| `PRD.md` | ANY feature change, new functionality, UI changes, acceptance criteria updates, roadmap changes, architecture changes, data model changes |
| `PRIVACY.md` | ANY change affecting user data, permissions, third-party APIs, data storage, or data transmission |
| `CHROMEWEBSTORE.md` | ANY user-facing feature change, permission changes, version releases, description updates |
| `README.md` | ANY architecture changes, file structure changes, new dependencies, API changes |

### Documentation Update Checklist

Before marking ANY task as complete, you MUST verify:

1. **PRD.md**
   - [ ] Updated implementation status checkboxes
   - [ ] Updated feature descriptions if behavior changed
   - [ ] Added new features to the appropriate phase/section
   - [ ] Updated acceptance criteria
   - [ ] Updated roadmap status if applicable
   - [ ] Updated data models if types changed
   - [ ] Updated architecture diagrams if structure changed

2. **PRIVACY.md**
   - [ ] Updated "Last Updated" date if any privacy-related changes
   - [ ] Updated permissions list if manifest.json changed
   - [ ] Added new third-party services if integrated
   - [ ] Updated data collection/storage sections if applicable

3. **CHROMEWEBSTORE.md**
   - [ ] Updated "Last Updated" date if any user-facing changes
   - [ ] Updated feature list in descriptions
   - [ ] Updated permissions justification if manifest.json changed
   - [ ] Added to Version History for releases

4. **README.md**
   - [ ] Updated architecture sections if structure changed
   - [ ] Updated file structure if files added/removed/moved
   - [ ] Updated dependencies if package.json changed

### Enforcement

- **DO NOT** complete a task without reviewing these documentation files
- **DO NOT** assume documentation is already up to date
- **ALWAYS** read the relevant documentation files before making changes
- **ALWAYS** update documentation in the SAME commit as the code changes
- If you are unsure whether documentation needs updating, UPDATE IT

This requirement exists because documentation drift causes significant maintenance burden. Every change, no matter how small, must keep documentation in sync.

---

## Project Overview

FolioLM (https://foliolm.com) is a browser extension that helps users collect sources from tabs, bookmarks, and history, then query and transform that content (e.g., create quizzes, podcasts, summaries).

## Browser Support

**Target: Latest Chrome only (Chrome 140+ as of December 2025)**

This extension exclusively targets the latest stable version of Chrome. This means:

- **No polyfills needed**: All modern JavaScript/Web APIs are natively supported
- **No legacy browser compatibility**: We do not support older Chrome versions, Firefox, Safari, or other browsers
- **Manifest V3**: Uses Chrome's latest extension platform

When adding dependencies or writing code:

- Do not add polyfills for features supported in Chrome 140+
- Use modern JavaScript features (ES2022+) freely
- Leverage Chrome-specific extension APIs without cross-browser abstractions
- The modulepreload polyfill is disabled in Vite config since Chrome 66+ supports it natively

## Modern Web Development

**IMPORTANT:** Always use the `/modernwebdev` skill when implementing features that interact with browser APIs.

This project mandates modern web platform APIs over legacy patterns. Before implementing any feature:

1. **Run `/modernwebdev`** to get guidance on the most current APIs
2. **Search documentation** on MDN, web.dev, and developer.chrome.com
3. **Verify browser support** meets Chrome 140+ requirements

### Required Modern Patterns

| Always Use | Never Use |
|------------|-----------|
| `fetch()` with async/await | `XMLHttpRequest` |
| `navigator.clipboard` | `document.execCommand('copy')` |
| ES Modules (`import`/`export`) | CommonJS, global scripts |
| `async`/`await` | Callback chains |
| Template literals | String concatenation |
| `structuredClone()` | `JSON.parse(JSON.stringify())` |
| `crypto.randomUUID()` | Manual UUID generation |
| `<dialog>` element | Custom modal divs |
| CSS Grid/Flexbox | Float layouts |
| IntersectionObserver | Scroll event polling |
| `URL`/`URLSearchParams` | Manual URL parsing |

### Chrome Extension Modern Patterns

| Always Use | Never Use |
|------------|-----------|
| Manifest V3 | Manifest V2 patterns |
| `chrome.scripting` | `chrome.tabs.executeScript` |
| Service workers | Background pages |
| `chrome.action` | `chrome.browserAction` |

When in doubt about which API to use, invoke `/modernwebdev` for research and recommendations.

## Type Safety

**CRITICAL:** Always use type guards instead of type coercion or non-null assertions.

### Type Guards vs Assertions

| Use | Avoid |
|-----|-------|
| `value === undefined` checks | Non-null assertion (`value!`) |
| Type guard functions (`assertEnv(value, name)`) | Type assertions (`as Type`) |
| Proper narrowing with `in` or `instanceof` | Casting without validation |

### Example: Type Guard Function

```typescript
// ✅ GOOD: Type guard that returns narrowed type
function assertEnv(value: string | undefined, name: string): string {
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const apiKey = assertEnv(process.env.API_KEY, "API_KEY"); // Type: string

// ❌ BAD: Non-null assertion
const apiKey = process.env.API_KEY!; // No runtime check
```

## Build Commands

```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server with HMR
npm run build        # TypeScript check + production build
npm run lint         # Run ESLint on src/
npm run lint:fix     # Run ESLint with auto-fix
npm run typecheck    # TypeScript type checking only
```

## Loading the Extension

1. Run `npm run build` to generate the `dist/` folder
2. Open `chrome://extensions/` in Chrome
3. Enable "Developer mode"
4. Click "Load unpacked" and select the `dist/` folder

For development with hot reload, run `npm run dev` and load the extension from the generated output.

## Architecture

### Manifest V3 Chrome Extension

- **Side Panel** (`src/sidepanel/`): Main UI for managing notebooks and sources
- **Background Service Worker** (`src/background/`): Handles message passing, content extraction via scripting API
- **Types** (`src/types/`): Shared TypeScript interfaces
- **Lib** (`src/lib/`): Shared utilities for permissions and chrome.storage

### Key Data Models

- `Notebook`: Collection of sources with metadata
- `Source`: Individual content item (tab, bookmark, history entry, or manual)
- Sources store extracted `textContent` for querying

### Permissions Strategy

- **Required**: `storage`, `sidePanel`, `activeTab`, `scripting`
- **Optional** (user must grant): `tabs`, `bookmarks`, `history`

Use `src/lib/permissions.ts` for permission checking and requests.

### Message Passing

Background script handles messages with types defined in `src/types/index.ts`:

- `EXTRACT_CONTENT`: Extract content from active tab
- `ADD_SOURCE`: Add extracted content to active notebook

### Storage

All data persisted via `chrome.storage.local`:

- `notebooks`: Array of Notebook objects
- `activeNotebookId`: Currently selected notebook

## Icons

Place PNG icons in `icons/` directory:

- icon16.png, icon32.png, icon48.png, icon128.png

## Privacy Policy Maintenance

**IMPORTANT:** Whenever making changes that could affect user privacy, you MUST review and update `PRIVACY.md`. This includes:

- Adding, removing, or modifying **permissions** in `manifest.json`
- Adding new **third-party API integrations** or services
- Changes to **data storage** (what data is stored, how it's stored)
- Changes to how **user content is transmitted** to external services
- Adding **new features** that access browser data (tabs, bookmarks, history)
- Modifications to the **content security policy**
- Adding **analytics, telemetry, or tracking** (should be avoided, but must be documented)

When updating `PRIVACY.md`:

1. Update the "Last Updated" date at the top of the file to the current date
2. Add or modify relevant sections to accurately reflect the new behavior
3. Ensure the permissions list matches `manifest.json`
4. Document any new third-party services and link to their privacy policies

## Documentation Maintenance Details

See the **MANDATORY: Documentation Updates Required for Every Change** section at the top of this file. The sections below provide additional detail on what to update in each file.

### CHROMEWEBSTORE.md

This file contains all store listing information and permission justifications.

Update `CHROMEWEBSTORE.md` when:

- Adding, removing, or modifying **permissions** in `manifest.json`
- Adding **new features** that should be mentioned in the store description
- Changing the **product description** or marketing copy
- Adding new **AI providers** or **transformation types**
- Making changes that affect **data usage** or **privacy disclosures**
- Releasing a **new version** (update the Version History section)

When updating `CHROMEWEBSTORE.md`:

1. Update the "Last Updated" date at the top of the file
2. Update the **Permissions Justification** section to match `manifest.json`
3. Update the **Detailed Description** if features have changed
4. Add a new entry to **Version History** for the release
5. Ensure **Data Usage Disclosure** accurately reflects current behavior

### PRD.md

The PRD (Product Requirements Document) is the source of truth for product features and implementation status. Update it when:

- Adding **new features** (add to appropriate phase section)
- Completing features (check off acceptance criteria checkboxes)
- Changing **existing functionality** (update feature descriptions)
- Modifying **data models** (update Data Models section)
- Adding new **source types** or **transformation types**
- Changing the **roadmap** or priorities
- Updating **architecture** decisions

When updating `PRD.md`:

1. Update **Implementation Status** checkboxes to reflect current state
2. Add new features to the correct phase (P0, P1, P2, P3, Future)
3. Write clear **Acceptance Criteria** for new features
4. Keep the **Architecture** section aligned with actual implementation
5. Update **Data Models** TypeScript interfaces when types change

### README.md

The README contains comprehensive architecture documentation. Update it when:

- Adding new components or major features
- Changing the project structure (new directories, renamed files)
- Adding or removing dependencies
- Modifying message types or data models
- Changing permissions requirements
- Adding new AI providers or transformation types

### What to Update in README.md

- **Architecture diagram**: If component relationships change
- **Project Structure**: If files/directories are added, removed, or moved
- **Data Models**: If types in `src/types/index.ts` change
- **Message Passing table**: If message types are added/removed
- **Permissions table**: If permissions change in manifest.json
- **Tech Stack**: If major dependencies are added/removed

## Testing Requirements

**IMPORTANT:** Unit tests are required for all code changes. Every feature and improvement must include corresponding tests.

### When to Add Tests

- **New features**: Every new feature must have unit tests that verify its functionality
- **Bug fixes**: Every bug fix must include a test that reproduces the bug and verifies the fix
- **Improvements/Refactoring**: Any code improvement or refactoring must maintain or improve test coverage
- **Utility functions**: All utility functions in `src/lib/` must have comprehensive unit tests

### Test Guidelines

- Place test files adjacent to the code they test, using the naming convention `*.test.ts` or `*.spec.ts`
- Test both success cases and error/edge cases
- Keep tests focused and independent - each test should verify one specific behavior
- Use descriptive test names that explain what is being tested
- Mock Chrome APIs and external dependencies appropriately

### Test Infrastructure

If test infrastructure is not yet set up in the repository:

1. Add a test framework (e.g., Vitest) as a dev dependency
2. Add a `test` script to `package.json`
3. Configure the test framework in the project configuration

### Running Tests

```bash
npm run test         # Run all tests
npm run test:watch   # Run tests in watch mode during development
```
