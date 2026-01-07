# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FolioLM (https://foliolm.com) is a browser extension that helps users collect sources from tabs, bookmarks, and history, then query and transform that content (e.g., create quizzes, podcasts, summaries).

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

## Content Security Policy (CSP)

The extension's CSP is defined in `manifest.json` under `content_security_policy.extension_pages`:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https:;"
}
```

**Key Points:**
- `script-src 'self'` - Only scripts from the extension can execute
- `object-src 'self'` - Only objects from the extension can be embedded
- `connect-src 'self' https:` - Extension can connect to itself and any HTTPS endpoint

**Why `https:` is allowed:**
- The OpenAI-Compatible provider requires connecting to user-configured custom endpoints
- Users might use local LLMs (Ollama), cloud aggregators (OpenRouter), or enterprise deployments (Azure OpenAI)
- All connections must use HTTPS (HTTP is automatically blocked by the browser for extensions)
- Users are responsible for trusting the endpoints they configure
- This is documented in PRIVACY.md and README.md

**Security Trade-offs:**
- ✅ Enables flexibility for custom AI endpoints
- ✅ Still requires HTTPS encryption
- ⚠️ Users must trust their configured endpoints
- ⚠️ Extension can't validate third-party endpoint security

If you modify the CSP, update both `PRIVACY.md` and `README.md` to reflect the changes.

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
