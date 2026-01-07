# FolioLM

A browser extension that helps you collect sources from tabs, bookmarks, and history, then query and transform that content using AI.

**Website**: [foliolm.com](https://foliolm.com)

## Features

- **Source Collection**: Gather content from open tabs, bookmarks, browser history, or paste text manually
- **AI-Powered Chat**: Query your collected sources with natural language, with citations back to original content
- **Transformations**: Convert your sources into 19 different formats:
  - **Educational**: Quiz, Flashcards, Study Guide
  - **Creative**: Podcast Script, Email, Slide Deck
  - **Analytical**: Report, Timeline, Comparison, Data Table, Mind Map
  - **Reference**: Glossary, FAQ, Outline, Citations
  - **Business**: Action Items, Executive Brief, Key Takeaways, Pros/Cons

## Installation

### From Source

```bash
npm install          # Install dependencies
npm run build        # Build the extension
```

1. Open `chrome://extensions/` in Chrome
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `dist/` folder

### Development

```bash
npm run dev          # Start Vite dev server with HMR
npm run lint         # Run ESLint
npm run typecheck    # TypeScript type checking
```

## Architecture

FolioLM is a Chrome Manifest V3 extension built with TypeScript and Vite.

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Chrome Browser                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │  Web Page 1  │  │  Web Page 2  │  │  Web Page 3  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                 │                       │
│         └─────────────────┴─────────────────┘                       │
│                      │                                               │
│                      ▼ (content extraction)                         │
│         ┌────────────────────────────┐                              │
│         │  Content Script (Turndown) │                              │
│         │   - HTML → Markdown        │                              │
│         │   - Message-based API      │                              │
│         └────────────┬───────────────┘                              │
│                      │                                               │
│                      ▼ (chrome.runtime.sendMessage)                 │
│  ┌──────────────────────────────────────────────┐                  │
│  │   Background Service Worker                  │                  │
│  │   - Message routing                          │                  │
│  │   - Context menu management                  │                  │
│  │   - Content extraction coordination          │                  │
│  └──────────────────┬───────────────────────────┘                  │
│                     │                                                │
│                     ▼ (message passing)                             │
│  ┌──────────────────────────────────────────────┐                  │
│  │   Side Panel UI                              │                  │
│  │   - Notebook management                      │                  │
│  │   - Source management                        │                  │
│  │   - Chat interface with streaming            │                  │
│  │   - Transformations                          │                  │
│  │   - Settings (API keys, AI providers)        │                  │
│  │                                              │                  │
│  │  ┌──────────────────────────────────────┐   │                  │
│  │  │ Sandboxed Iframe                     │   │                  │
│  │  │ - Renders AI-generated content       │   │                  │
│  │  │ - Defense-in-depth security          │   │                  │
│  │  └──────────────────────────────────────┘   │                  │
│  └──────────────────┬───────────────────────────┘                  │
│                     │                                                │
│                     ▼ (IndexedDB)                                   │
│  ┌──────────────────────────────────────────────┐                  │
│  │   Storage Layer                              │                  │
│  │   - Notebooks & Sources                      │                  │
│  │   - Chat history                             │                  │
│  │   - AI settings & API keys                   │                  │
│  │   - Response cache                           │                  │
│  └──────────────────────────────────────────────┘                  │
│                                                                      │
│                     ▼ (HTTPS)                                       │
│         ┌─────────────────────────────┐                             │
│         │  AI Providers               │                             │
│         │  - Anthropic (Claude)       │                             │
│         │  - OpenAI (GPT)             │                             │
│         │  - Google (Gemini)          │                             │
│         │  - Chrome Built-in AI       │                             │
│         └─────────────────────────────┘                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Project Structure

```
src/
├── background/          # Background service worker
│   └── index.ts         # Message handling, context menus, extraction coordination
├── content/             # Content script
│   └── index.ts         # HTML→Markdown extraction using Turndown
├── lib/                 # Shared utilities
│   ├── ai.ts            # AI provider abstraction (Vercel AI SDK)
│   ├── db.ts            # IndexedDB schema and helpers
│   ├── permissions.ts   # Chrome permissions management
│   ├── sandbox-renderer.ts  # Secure iframe rendering
│   ├── settings.ts      # AI settings persistence
│   └── storage.ts       # Storage adapter implementation
├── sandbox/             # Sandboxed iframe for AI content
│   ├── sandbox.html
│   └── sandbox.ts
├── sidepanel/           # Main UI
│   ├── index.html
│   └── index.ts         # Tabs, chat, transforms, library, settings
└── types/               # TypeScript interfaces
    └── index.ts         # Notebook, Source, ChatMessage, etc.
```

### Key Components

#### Background Service Worker (`src/background/index.ts`)

Handles extension-level operations:
- **Context Menus**: "Add page to Folio" / "Add link to Folio" with notebook submenus
- **Message Routing**: Routes messages between content scripts and side panel
- **Content Extraction**: Coordinates extraction via content script or fallback injection

#### Content Script (`src/content/index.ts`)

Injected into every web page to extract content:
- Uses [Turndown](https://github.com/mixmark-io/turndown) for HTML→Markdown conversion
- Custom rules to filter noise (nav, footer, ads) and simplify links/images
- Tries semantic selectors (`<article>`, `<main>`, `[role="main"]`) before falling back to `<body>`

#### Side Panel (`src/sidepanel/index.ts`)

The main user interface with five tabs:
1. **Add Sources**: Import from current tab, tabs, bookmarks, or history
2. **Chat**: Query sources with AI, streaming responses with citations
3. **Transform**: Generate 19 different content formats
4. **Library**: Browse and manage notebooks
5. **Settings**: Configure AI provider, API keys, model selection

#### Storage Layer (`src/lib/storage.ts`, `src/lib/db.ts`)

IndexedDB-backed persistence:
- **Stores**: notebooks, sources, chatMessages, transformations, settings, responseCache
- **Factory Functions**: `createNotebook()`, `createSource()`, `createChatMessage()`
- **Sync Ready**: Data model includes `syncStatus` for future cloud sync

#### AI Integration (`src/lib/ai.ts`)

Unified AI provider interface using Vercel AI SDK:
- **Providers**: Anthropic, OpenAI, Google, Chrome Built-in AI
- **Chat**: Streaming responses with citation parsing
- **Transformations**: 19 specialized generation functions
- **Custom Endpoints**: Supports custom `baseURL` for enterprise/local deployments

#### Sandbox Renderer (`src/lib/sandbox-renderer.ts`)

Defense-in-depth security for AI-generated content:
1. **DOMPurify**: Sanitizes HTML before rendering
2. **Sandboxed Iframe**: Runs without `allow-same-origin` for complete isolation
3. **postMessage Communication**: Only interaction method with sandbox

### Data Models

```typescript
// Core entities (from src/types/index.ts)

interface Notebook {
  id: string;
  name: string;
  syncStatus: 'local' | 'synced' | 'pending' | 'conflict';
  createdAt: number;
  updatedAt: number;
}

interface Source {
  id: string;
  notebookId: string;
  type: 'tab' | 'bookmark' | 'history' | 'manual' | 'text';
  url: string;
  title: string;
  textContent: string;  // Extracted markdown content
  favicon?: string;
  description?: string;
  wordCount?: number;
  // ... timestamps, sync fields
}

interface ChatMessage {
  id: string;
  notebookId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: number;
}

interface Citation {
  sourceId: string;
  sourceTitle: string;
  excerpt: string;
}
```

### Message Passing

Messages between components (defined in `src/types/index.ts`):

| Message Type | Direction | Purpose |
|--------------|-----------|---------|
| `EXTRACT_CONTENT` | Side Panel → Background | Extract from active tab |
| `EXTRACT_FROM_URL` | Side Panel → Background | Extract from arbitrary URL |
| `ADD_SOURCE` | Background → Side Panel | Notify source added |
| `CREATE_NOTEBOOK_AND_ADD_PAGE` | Background → Side Panel | Context menu new notebook |
| `REBUILD_CONTEXT_MENUS` | Side Panel → Background | Update context menus |

### Permissions

| Permission | Type | Purpose |
|------------|------|---------|
| `storage` | Required | IndexedDB access |
| `sidePanel` | Required | Side panel UI |
| `activeTab` | Required | Current tab extraction |
| `scripting` | Required | Content script injection |
| `contextMenus` | Required | Right-click menus |
| `<all_urls>` | Required | Content extraction on all pages |
| `tabs` | Optional | List all open tabs |
| `tabGroups` | Optional | Access tab groups |
| `bookmarks` | Optional | Read bookmarks |
| `history` | Optional | Search browser history |

### Security

- **CSP**: Strict Content Security Policy in manifest
- **XSS Prevention**: Triple-layer defense (escape → format → DOMPurify)
- **Sandbox Isolation**: AI content rendered in sandboxed iframe
- **API Key Storage**: Per-provider keys stored in local IndexedDB only

## Configuration

### AI Providers

Configure in Settings tab:
1. Select provider (Anthropic, OpenAI, Google, or Chrome Built-in)
2. Enter API key (not required for Chrome Built-in)
3. Select model
4. Optional: Set custom base URL for enterprise deployments

### Advanced Settings

- **Temperature**: Controls response creativity (0-2)
- **Max Tokens**: Limits response length
- **Base URL**: Custom endpoint for local/enterprise LLM deployments

## Tech Stack

- **Runtime**: Chrome Extension Manifest V3
- **Language**: TypeScript
- **Build**: Vite + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/docs) with provider packages
- **Sanitization**: [DOMPurify](https://github.com/cure53/DOMPurify)
- **HTML→Markdown**: [Turndown](https://github.com/mixmark-io/turndown)

## License

MIT
