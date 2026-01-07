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
