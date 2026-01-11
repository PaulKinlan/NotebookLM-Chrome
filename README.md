# FolioLM

A browser extension that helps you collect sources from tabs, bookmarks, and history, then query and transform that content using AI.

**Website**: [foliolm.com](https://foliolm.com)

## Features

- **Source Collection**: Gather content from open tabs, bookmarks, browser history, or paste text manually
- **AI-Powered Chat**: Query your collected sources with natural language, with citations back to original content
- **Multi-Provider Support**: 16+ AI providers including Anthropic, OpenAI, Google, Groq, Mistral, and Chrome Built-in AI
- **Flexible Configuration**: Named credentials, per-notebook model overrides, and custom endpoints
- **Usage Analytics**: Track token usage and estimated costs per AI profile with visual charts
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
│         │  AI Providers (16+)         │                             │
│         │  - Anthropic, OpenAI        │                             │
│         │  - Google, OpenRouter       │                             │
│         │  - Groq, Mistral, and more  │                             │
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
│   ├── credentials.ts   # Named API key management
│   ├── db.ts            # IndexedDB schema and helpers (v3)
│   ├── markdown-renderer.ts  # Markdown to HTML conversion
│   ├── model-configs.ts # Model configuration management
│   ├── permissions.ts   # Chrome permissions management
│   ├── provider-registry.ts  # Centralized provider configuration with pricing
│   ├── sandbox-renderer.ts   # Secure iframe rendering
│   ├── settings.ts      # AI settings persistence
│   ├── storage.ts       # Storage adapter implementation
│   └── usage.ts         # Usage tracking and cost calculation
├── sandbox/             # Sandboxed iframe for AI content
│   ├── sandbox.html
│   └── sandbox.ts
├── sidepanel/           # Main UI
│   ├── index.html
│   ├── index.ts         # Tabs, chat, transforms, library, settings
│   ├── dropdown.ts      # Reusable dropdown component
│   ├── provider-config-ui.ts  # Provider and model configuration UI
│   └── styles.css       # UI styling
└── types/               # TypeScript interfaces
    └── index.ts         # Notebook, Source, ChatMessage, Credential, ModelConfig, etc.
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

IndexedDB-backed persistence (schema v3):
- **Stores**: notebooks, sources, chatMessages, transformations, settings, responseCache, summaries, providerConfigs
- **Factory Functions**: `createNotebook()`, `createSource()`, `createChatMessage()`
- **Sync Ready**: Data model includes `syncStatus` for future cloud sync

#### AI Integration (`src/lib/ai.ts`, `src/lib/provider-registry.ts`)

Unified AI provider interface using Vercel AI SDK:
- **16+ Providers**: Anthropic, OpenAI, Google, OpenRouter, Groq, Mistral, Together AI, DeepInfra, Perplexity, Fireworks AI, Hugging Face, z.ai, Chrome Built-in AI, and more
- **Provider Registry**: Centralized configuration for all provider metadata, endpoints, and authentication
- **Chat**: Streaming responses with citation parsing
- **Transformations**: 19 specialized generation functions
- **Custom Endpoints**: Supports custom `baseURL` for enterprise/local deployments

#### Credential Management (`src/lib/credentials.ts`)

Named API key management:
- **Named Credentials**: Store multiple API keys with user-defined names (e.g., "Work OpenAI", "Personal Anthropic")
- **Default Credential**: Set a default credential for quick access
- **Deduplication**: Prevents duplicate API keys

#### Model Configuration (`src/lib/model-configs.ts`)

Flexible model configuration system:
- **Model Configs**: Named configurations linking credentials to provider/model selections
- **Per-Notebook Override**: Each notebook can use a specific model config
- **Default Chrome Built-in Profile**: Automatically created on first install
- **Legacy Migration**: Seamlessly migrates from older AISettings format

#### Usage Tracking (`src/lib/usage.ts`)

Per-profile API usage tracking and cost monitoring:
- **Automatic Tracking**: Records tokens (input/output) for all AI operations
- **Cost Calculation**: Estimates costs based on embedded model pricing data
- **Visual Analytics**: Bar chart showing tokens per day with cost overlay
- **Time Range Selection**: View stats for day, week, month, quarter, or year
- **Summary Statistics**: Total tokens, input/output breakdown, cost, request count
- **Storage**: Usage records persisted in `chrome.storage.local`

Access usage stats via the chart icon next to each AI profile in Settings.

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
  modelConfigId?: string;  // Optional per-notebook model override
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

// AI Configuration (from src/types/index.ts)

interface Credential {
  id: string;
  name: string;           // User-defined name (e.g., "Work OpenAI")
  apiKey: string;
  createdAt: number;
  updatedAt: number;
}

interface ModelConfig {
  id: string;
  name: string;           // Profile name (e.g., "Fast Responses")
  credentialId: string;   // References a Credential
  providerId: string;     // Provider from registry
  modelId: string;        // Model identifier
  temperature?: number;
  maxTokens?: number;
  createdAt: number;
  updatedAt: number;
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

FolioLM supports 16+ AI providers through a centralized provider registry:

| Provider | Default Model | API Key Required |
|----------|---------------|------------------|
| Anthropic | claude-sonnet-4-5-20250514 | Yes |
| OpenAI | gpt-5 | Yes |
| Google Gemini | gemini-3-pro-preview | Yes |
| Google Vertex Express | gemini-2.5-flash | Yes |
| OpenRouter | anthropic/claude-3.5-sonnet | Yes |
| Groq | llama-3.3-70b-versatile | Yes |
| Mistral | mistral-large-latest | Yes |
| Together AI | meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo | Yes |
| DeepInfra | meta-llama/Meta-Llama-3.1-70B-Instruct | Yes |
| Perplexity | sonar | Yes |
| Fireworks AI | llama-v3p1-70b-instruct | Yes |
| Hugging Face | Qwen/Qwen2.5-Coder-32B-Instruct | Yes |
| z.ai (Anthropic) | glm-4.7 | Yes |
| z.ai (OpenAI) | glm-4.7 | Yes |
| z.ai (Coding) | glm-4.7 | Yes |
| Chrome Built-in | — | No |

### Setting Up AI

1. **Create a Credential**: In Settings, add a named API key (e.g., "Work OpenAI")
2. **Create a Model Config**: Link a credential to a provider and model
3. **Set Default**: Choose your default model config for new notebooks
4. **Per-Notebook Override**: Optionally assign different configs to specific notebooks

### Advanced Settings

- **Temperature**: Controls response creativity (0-2)
- **Max Tokens**: Limits response length
- **Dynamic Model Lists**: Many providers support fetching available models via API

## Tech Stack

- **Runtime**: Chrome Extension Manifest V3
- **Language**: TypeScript
- **Build**: Vite 6 + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin)
- **AI**: [Vercel AI SDK](https://sdk.vercel.ai/docs) with provider packages:
  - `@ai-sdk/anthropic`, `@ai-sdk/openai`, `@ai-sdk/google`
  - `@ai-sdk/groq`, `@ai-sdk/mistral`, `@ai-sdk/huggingface`
  - `@ai-sdk/openai-compatible` (for compatible providers)
  - `@openrouter/ai-sdk-provider`
  - `@anthropic-ai/sdk`, `@built-in-ai/core`
- **Markdown**: [marked](https://github.com/markedjs/marked) (parsing), [Turndown](https://github.com/mixmark-io/turndown) (HTML→Markdown)
- **Sanitization**: [DOMPurify](https://github.com/cure53/DOMPurify)

## License

MIT
