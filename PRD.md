# NotebookLM Chrome - Product Requirements Document

## Overview

NotebookLM Chrome is a browser extension that brings NotebookLM-style functionality directly into Chrome. Users can collect web content from tabs, bookmarks, and browsing history into notebooks, then query, summarize, and transform that content using AI.

## Problem Statement

Users frequently encounter valuable information across multiple web pages but lack an easy way to:
- Collect and organize content from different sources
- Query across multiple sources simultaneously
- Transform content into different formats (summaries, quizzes, podcasts)
- Do all of this without leaving their browser

## Target Users

- Researchers gathering information from multiple sources
- Students studying topics across various websites
- Professionals conducting competitive analysis or market research
- Content creators looking to synthesize information
- Anyone who wants to learn from or summarize web content

---

## Core Features

### 1. Source Management

#### 1.1 Notebooks
- Create, rename, and delete notebooks
- Each notebook contains multiple sources
- Notebooks persist in IndexedDB (with sync hooks for future server sync)
- Active notebook tracked across sessions

#### 1.2 Source Types
| Source Type | Permission Required | Description |
|-------------|---------------------|-------------|
| Current Tab | `activeTab` (required) | Add the currently active tab |
| Selected Tabs | `activeTab` (required) | Add multiple highlighted/selected tabs at once |
| Open Tabs | `tabs` (optional) | Browse and select from all open tabs via picker |
| Bookmarks | `bookmarks` (optional) | Browse and select from bookmarks via picker |
| History | `history` (optional) | Search and select from browsing history via picker |
| Context Menu | `contextMenus` (required) | Right-click to add page or link |

#### 1.3 Content Extraction
Uses **Turndown** library in a content script to convert HTML to clean markdown:

**Strategy:**
- Content script auto-injected on all pages via manifest (`document_idle`)
- Turndown converts HTML to markdown with custom rules
- Fallback inline extraction for pages loaded before extension install
- Background script requests extraction via message passing

**Turndown Rules:**
- Remove noise: `style`, `script`, `noscript`, `iframe`, `nav`, `footer`, `header`, `aside`, `form`, `input`
- Flatten links: Keep text, remove `<a>` tags (cleaner for AI context)

**Output:** Markdown stored in `Source.content` for AI processing

### 2. AI Integration

#### 2.1 Provider Support
Uses the Vercel AI SDK (`npm:ai`) with provider packages:

| Provider | Package | Models | Use Case |
|----------|---------|--------|----------|
| Anthropic | `@ai-sdk/anthropic` | Claude 4.5 Sonnet, Opus, Haiku | High-quality reasoning and analysis |
| OpenAI | `@ai-sdk/openai` | GPT-5, GPT-5 Mini, GPT-5.1 Instant | General purpose, fast responses |
| Google | `@ai-sdk/google` | Gemini 2.5 Flash/Pro, Gemini 3 Pro/Flash (Preview) | Cost-effective, multimodal capable |
| Chrome Built-in | `@built-in-ai/core` | Gemini Nano | Offline, privacy-focused, free |

#### 2.2 Settings UI
- Model provider selection dropdown
- Model selection per provider
- API key input fields (stored in IndexedDB per provider)
- Test connection button
- Chrome Built-in AI works without API key

#### 2.3 Context Management
- Combine source content into context for queries
- Source attribution in prompts
- Streaming responses for real-time feedback

### 3. Query & Chat

#### 3.1 Chat Interface
- Query input in the side panel
- Streaming responses with live updates
- Source-aware context building
- Basic markdown rendering in responses

#### 3.2 Query Types
- Open-ended questions about sources
- Comparison queries ("How does X differ from Y?")
- Fact extraction ("What are the key dates mentioned?")
- Synthesis ("Combine these perspectives on...")

### 4. Transformations

Four transformation types accessible from the Transform tab:

#### 4.1 Podcast Script
- Generate conversational dialogue between two hosts
- Hosts discuss and explain the source content
- Configurable length (default: 5 minutes)

#### 4.2 Study Quiz
- Multiple choice questions (default: 5 questions)
- Questions with 4 options each
- Answer and explanation provided

#### 4.3 Key Takeaways
- Extract the most important bullet points
- Formatted as a clear, actionable list

#### 4.4 Email Summary
- Professional email summary for sharing
- Includes key findings and structure
- Copy-ready format

### 5. Context Menu Integration

Right-click context menu for quick source addition:
- **"Add page to Notebook"** - On any page, extracts and adds content
- **"Add link to Notebook"** - On any link, opens URL in background, extracts content, closes tab
- Opens side panel after adding (or if no notebook selected)

### 6. Multi-Tab Selection

When multiple tabs are highlighted in the browser:
- Button automatically changes from "Add Current Tab" to "Add X Selected Tabs"
- Clicking adds all selected tabs to the notebook
- Updates dynamically as tab selection changes

---

## User Interface

**Design Assets:** See `/designs/` folder for visual mockups.

**Theme:** Dark mode UI with blue accent colors.

**Tech Stack:** Vanilla TypeScript (no React), CSS with variables.

### Navigation
Bottom tab bar with five sections:
- **Add** - Add sources to notebook
- **Chat** - Query and interact with sources
- **Transform** - Generate transformations from sources
- **Library** - Browse notebooks
- **Settings** - Configure AI providers and permissions

### Main View: Add Sources Screen
`designs/add_sources_to_notebook/screen.png`

| Element | Description |
|---------|-------------|
| Header | "Add Sources" title |
| Primary Action | Blue "Add Current Tab" / "Add X Selected Tabs" button |
| Search | Search field to filter added sources |
| Import Options | Three card-style buttons with picker modals: |
| | - **Select from Open Tabs** - Multi-select picker |
| | - **Add from Bookmarks** - Bookmark browser picker |
| | - **Add from History** - History search picker |
| Recent Sources | Previously added sources with title, domain, remove button |

### Chat Screen
`designs/notebook_summary_&_query/screen.png`

| Element | Description |
|---------|-------------|
| Notebook Selector | Dropdown to select/create notebooks |
| Query Input | Search field: "Ask a question about your sources..." with submit button |
| Helper Text | "Ask questions to synthesize information from your active sources below" |
| Active Sources | List of sources with initial icon, title, domain, remove button |
| Add Current Page | Button to quickly add the current tab |
| Generated Summary | AI-generated response with markdown formatting, timestamp, copy button |

### Transform Screen
`designs/content_transformation_options/screen.png`

| Element | Description |
|---------|-------------|
| Header | "Transform" title with helper text |
| Transform Options | 2x2 grid of card-style buttons: |
| | - **Podcast Script** (orange icon) - "Generate a 2-person conversation" |
| | - **Study Quiz** (purple icon) - "Test your knowledge" |
| | - **Key Takeaways** (green icon) - "Extract main points" |
| | - **Email Summary** (blue icon) - "Professional summary to share" |
| Result Panel | Generated content with copy/close buttons |

### Picker Modal
Shared modal for tabs, bookmarks, and history selection:

| Element | Description |
|---------|-------------|
| Header | Title (e.g., "Select Tabs") with close button |
| Search | Filter input to search items |
| Item List | Scrollable list with checkbox, favicon/initial, title, URL |
| Footer | Selected count + Cancel/Add Selected buttons |

### Settings Panel
- AI Provider selection (Anthropic, OpenAI, Google, Chrome Built-in)
- Model selection dropdown (updates per provider)
- API key input (hidden for Chrome Built-in)
- Test connection button
- Permission toggles (Tabs, Bookmarks, History)

---

## Technical Architecture

### Extension Components

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Side Panel  │  │ Background  │  │ Content Script  │ │
│  │ (Vanilla TS)│◄─┤   Worker    ├─►│  (Turndown)     │ │
│  │             │  │             │  │                 │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────┘ │
│                          │                              │
│                   ┌──────▼──────┐                       │
│                   │  IndexedDB  │                       │
│                   │  (Storage)  │                       │
│                   └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │     AI Providers        │
              │  (Vercel AI SDK)        │
              │  Anthropic, OpenAI,     │
              │  Google, Chrome Built-in│
              └─────────────────────────┘
```

### File Structure

```
src/
├── background/
│   └── index.ts          # Service worker, context menus, message handling
├── content/
│   └── index.ts          # Turndown-based content extraction
├── lib/
│   ├── ai.ts             # AI provider integration (Vercel AI SDK)
│   ├── db.ts             # IndexedDB wrapper
│   ├── permissions.ts    # Permission request handling
│   ├── settings.ts       # AI settings storage
│   └── storage.ts        # StorageAdapter implementation
├── sidepanel/
│   ├── index.html        # Side panel UI structure
│   ├── index.ts          # UI logic, event handling
│   └── styles.css        # Dark theme CSS
└── types/
    └── index.ts          # TypeScript type definitions
```

### Data Models

```typescript
// Base interface for sync-enabled entities
interface SyncableEntity {
  id: string;
  remoteId?: string;
  syncStatus: 'local' | 'synced' | 'pending' | 'conflict';
  lastSynced?: number;
  createdAt: number;
  updatedAt: number;
}

interface Notebook extends SyncableEntity {
  name: string;
}

interface Source extends SyncableEntity {
  notebookId: string;
  type: 'tab' | 'bookmark' | 'history' | 'manual' | 'text';
  url: string;
  title: string;
  content: string;
  metadata?: {
    favicon?: string;
    description?: string;
    wordCount?: number;
  };
}

interface ChatMessage {
  id: string;
  notebookId: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: number;
}

interface Transformation extends SyncableEntity {
  notebookId: string;
  type: 'podcast' | 'quiz' | 'takeaways' | 'email';
  title: string;
  content: string;
  sourceIds: string[];
}

interface AISettings {
  provider: 'anthropic' | 'openai' | 'google' | 'chrome';
  model: string;
  apiKeys: Record<string, string>;  // Per-provider API keys
}
```

### AI Provider Integration

```typescript
import { streamText, generateText, type LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createOpenAI } from '@ai-sdk/openai';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { builtInAI } from '@built-in-ai/core';

async function getModel(): Promise<LanguageModel | null> {
  const settings = await getAISettings();
  const apiKey = await getApiKey(settings.provider);

  switch (settings.provider) {
    case 'anthropic':
      return createAnthropic({ apiKey })(settings.model);
    case 'openai':
      return createOpenAI({ apiKey })(settings.model);
    case 'google':
      return createGoogleGenerativeAI({ apiKey })(settings.model);
    case 'chrome':
      return builtInAI();  // No API key needed
  }
}
```

---

## Implementation Status

### Completed
- [x] Project setup (TypeScript, Vite, CRXJS)
- [x] Manifest V3 with optional permissions
- [x] Side panel UI with dark theme
- [x] Bottom tab navigation (Add, Chat, Transform, Library, Settings)
- [x] IndexedDB storage with StorageAdapter
- [x] Notebook CRUD operations
- [x] Source management (add, remove, list)
- [x] Content extraction with Turndown
- [x] Fallback inline content extraction
- [x] Vercel AI SDK integration
- [x] Multi-provider support (Anthropic, OpenAI, Google, Chrome Built-in)
- [x] Streaming chat responses
- [x] Transformations (Podcast, Quiz, Takeaways, Email)
- [x] Settings panel with per-provider API keys
- [x] Tab picker modal with multi-select
- [x] Bookmark picker modal
- [x] History picker modal
- [x] Context menu (Add page, Add link)
- [x] Multi-tab selection support
- [x] Permission request flow

### Remaining
- [ ] Improved content extraction (Readability.js fallback)
- [ ] Source citations in responses
- [ ] Chat history persistence
- [ ] Offline caching of AI responses
- [ ] Audio generation for podcast scripts (TTS)
- [ ] Export functionality (markdown, JSON)
- [ ] Onboarding flow
- [ ] Error handling polish
- [ ] Chrome Web Store listing

---

## Success Metrics

- Sources added per notebook (target: avg 5+)
- Queries per session (target: avg 3+)
- Transformation usage rate
- User retention (weekly active users)
- Chrome Web Store rating

---

## Architecture Decisions

### Storage: IndexedDB
All data stored in IndexedDB for unlimited local storage capacity:
- Notebooks and sources stored separately (sources reference notebookId)
- Settings stored as key-value pairs
- Designed for future sync with SyncableEntity base type

### Offline Support (Partial)
- Chrome Built-in AI works fully offline
- Sources and notebooks available offline
- Cloud AI responses require network

### Sync Strategy
Design with sync hooks for future server-based sync:
- Each entity has `syncStatus`, `remoteId`, `lastSynced`
- StorageAdapter interface abstracts storage operations
- Server sync implementation deferred to future phase

### Chrome Built-in AI
Uses `@built-in-ai/core` community package for Vercel AI SDK compatibility:
- No API key required
- Works offline
- Requires Chrome 128+ with experimental flags

---

## Appendix: Chrome Built-in AI

Chrome's built-in AI (Gemini Nano) is available in Chrome 128+ with experimental flags.

**Package:** `@built-in-ai/core`

**Usage:**
```typescript
import { builtInAI } from '@built-in-ai/core';
const model = builtInAI();
```

**Benefits:**
- Free (no API costs)
- Fast (runs locally)
- Private (data doesn't leave device)
- Works offline

**Limitations:**
- Smaller model (less capable than cloud models)
- Limited context window
- Requires Chrome flags to enable (for now)
- Not available on all devices
