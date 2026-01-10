# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## Documentation Maintenance

When making significant changes to the project, ensure documentation stays up to date:

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
