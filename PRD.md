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

#### 1.2 Source Types
| Source Type | Permission Required | Description |
|-------------|---------------------|-------------|
| Current Tab | `activeTab` (required) | Add the currently active tab |
| Open Tabs | `tabs` (optional) | Browse and select from all open tabs |
| Bookmarks | `bookmarks` (optional) | Browse bookmark folders and select items |
| History | `history` (optional) | Search and select from browsing history |
| Manual URL | None | Paste a URL to fetch and add |
| Text Input | None | Paste raw text content directly |

#### 1.3 Content Extraction
Uses **Turndown** library in a content script to convert HTML to clean markdown:

**Strategy:**
- Content script injected on all pages (`document_idle`)
- Turndown converts HTML to markdown with custom rules
- Background script requests extraction via message passing

**Content Selection Priority:**
1. `<article>` element
2. `<main>` or `[role="main"]`
3. Common content selectors (`.post-content`, `.article-content`, `.entry-content`)
4. Fallback to `<body>`

**Turndown Rules:**
- Remove noise: `style`, `script`, `noscript`, `iframe`, `nav`, `footer`, `header`, `aside`, `form`, `input`
- Flatten links: Keep text, remove `<a>` tags (cleaner for AI context)
- Remove images (configurable)

**Output:** Markdown stored in `Source.content` for AI processing

### 2. AI Integration

#### 2.1 Provider Support
Use the Vercel AI SDK (`npm:ai`) to support multiple providers:

| Provider | Models | Use Case |
|----------|--------|----------|
| Anthropic | Claude 4.5 Sonnet, Claude 4.5 Opus | High-quality reasoning and analysis |
| OpenAI | GPT-5.2 | General purpose, fast responses |
| Google | Gemini Pro, Gemini Flash 3.0 | Cost-effective, multimodal capable |
| Chrome Built-in | Gemini Nano | Offline, privacy-focused, free |

#### 2.2 Settings UI
- Model provider selection dropdown
- API key input fields (stored securely in chrome.storage.local)
- Model-specific settings (temperature, max tokens)
- Test connection button
- Chrome Built-in AI availability check

#### 2.3 Context Management
- Combine source content into context for queries
- Handle context length limits per model
- Chunking strategies for large source collections
- Source attribution in responses

### 3. Query & Chat

#### 3.1 Chat Interface
- Conversational UI in the side panel
- Message history per notebook
- Streaming responses
- Source citations with links

#### 3.2 Query Types
- Open-ended questions about sources
- Comparison queries ("How does X differ from Y?")
- Fact extraction ("What are the key dates mentioned?")
- Synthesis ("Combine these perspectives on...")

### 4. Transformations

#### 4.1 Summarization
- Single source summaries
- Multi-source synthesis
- Configurable length (brief, standard, detailed)
- Key points extraction
- Export as text/markdown

#### 4.2 Quiz Generation
- Multiple choice questions
- True/false questions
- Short answer prompts
- Configurable difficulty and quantity
- Interactive quiz mode with scoring
- Export quiz as JSON or text

#### 4.3 Audio/Podcast Generation (NotebookLM-style)

##### Script Generation
- Generate conversational dialogue between two hosts
- Hosts discuss and explain the source content
- Natural conversation flow with questions, explanations, tangents
- Configurable tone (casual, educational, professional)
- Configurable length (5, 10, 15, 30 minutes of content)

##### Text-to-Speech
| TTS Provider | Features |
|--------------|----------|
| OpenAI TTS | High quality, multiple voices |
| ElevenLabs | Most natural, voice cloning option |
| Google Cloud TTS | Cost-effective, many languages |
| Browser SpeechSynthesis | Free, offline, lower quality |

##### Audio Output
- Generate separate audio for each host
- Merge into single podcast file
- Download as MP3/WAV
- Playback controls in extension

---

## User Interface

### Side Panel Layout

```
┌─────────────────────────────────┐
│ NotebookLM Chrome        [⚙️]  │
├─────────────────────────────────┤
│ [Notebook Dropdown ▼]  [+ New] │
├─────────────────────────────────┤
│ SOURCES (5)            [+ Add] │
│ ┌─────────────────────────────┐│
│ │ 📄 Article Title           ││
│ │    example.com             ││
│ │    [Remove]                ││
│ └─────────────────────────────┘│
│ ┌─────────────────────────────┐│
│ │ 📄 Another Source          ││
│ │    docs.example.com        ││
│ └─────────────────────────────┘│
├─────────────────────────────────┤
│ ACTIONS                         │
│ [💬 Chat] [📝 Summary]         │
│ [❓ Quiz] [🎙️ Podcast]         │
├─────────────────────────────────┤
│ CHAT                            │
│ ┌─────────────────────────────┐│
│ │ User: What are the main... ││
│ │                            ││
│ │ AI: Based on your sources..││
│ └─────────────────────────────┘│
│ ┌─────────────────────────────┐│
│ │ Ask a question...    [Send]││
│ └─────────────────────────────┘│
└─────────────────────────────────┘
```

### Settings Panel

```
┌─────────────────────────────────┐
│ ← Settings                      │
├─────────────────────────────────┤
│ AI PROVIDER                     │
│ [Anthropic ▼]                   │
│                                 │
│ MODEL                           │
│ [Claude 4.5 Sonnet ▼]          │
│                                 │
│ API KEY                         │
│ [sk-ant-•••••••••••]  [Test]   │
│                                 │
│ ─────────────────────────────── │
│ TTS PROVIDER                    │
│ [OpenAI TTS ▼]                  │
│                                 │
│ TTS API KEY                     │
│ [sk-•••••••••••••••]           │
│                                 │
│ ─────────────────────────────── │
│ PERMISSIONS                     │
│ ☑️ Tabs - View all open tabs    │
│ ☑️ Bookmarks - Access bookmarks │
│ ☐ History - Access history      │
└─────────────────────────────────┘
```

### Add Source Modal

```
┌─────────────────────────────────┐
│ Add Sources              [✕]   │
├─────────────────────────────────┤
│ [Current Tab] [Tabs] [Bookmarks]│
├─────────────────────────────────┤
│ 🔍 [Search tabs...]             │
│                                 │
│ ☐ Tab 1: Google Docs           │
│ ☑️ Tab 2: MDN Web Docs          │
│ ☑️ Tab 3: Stack Overflow        │
│ ☐ Tab 4: GitHub                │
│                                 │
│           [Add Selected (2)]    │
└─────────────────────────────────┘
```

---

## Technical Architecture

### Extension Components

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐ │
│  │ Side Panel  │  │ Background  │  │ Content Script  │ │
│  │   (React?)  │◄─┤   Worker    ├─►│  (Extraction)   │ │
│  │             │  │             │  │                 │ │
│  └─────────────┘  └──────┬──────┘  └─────────────────┘ │
│                          │                              │
│                   ┌──────▼──────┐                       │
│                   │  IndexedDB  │                       │
│                   │  + Sync API │                       │
│                   └─────────────┘                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │     AI Providers        │
              │  (Anthropic, OpenAI,    │
              │   Gemini, Chrome AI)    │
              └─────────────────────────┘
```

### Data Models

```typescript
// Base interface for sync-enabled entities
interface SyncableEntity {
  id: string;              // Local UUID
  remoteId?: string;       // Server ID (when synced)
  syncStatus: 'local' | 'synced' | 'pending' | 'conflict';
  lastSynced?: number;
  createdAt: number;
  updatedAt: number;
}

interface Notebook extends SyncableEntity {
  name: string;
  sources: Source[];
  chatHistory: ChatMessage[];
}

interface Source extends SyncableEntity {
  type: 'tab' | 'bookmark' | 'history' | 'manual' | 'text';
  url: string;
  title: string;
  content: string;        // Plain text content
  htmlContent?: string;   // Original HTML (optional)
  metadata?: {
    favicon?: string;
    description?: string;
    wordCount?: number;
  };
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  timestamp: number;
}

interface Citation {
  sourceId: string;
  excerpt: string;
}

interface AISettings {
  provider: 'anthropic' | 'openai' | 'google' | 'chrome';
  model: string;
  apiKey?: string;  // Not needed for Chrome Built-in
  temperature?: number;
  maxTokens?: number;
}

interface TTSSettings {
  provider: 'openai' | 'elevenlabs' | 'google' | 'browser';
  apiKey?: string;
  voice1: string;  // First podcast host
  voice2: string;  // Second podcast host
}

// Storage abstraction for future sync
interface StorageAdapter {
  // Notebooks
  getNotebooks(): Promise<Notebook[]>;
  getNotebook(id: string): Promise<Notebook | null>;
  saveNotebook(notebook: Notebook): Promise<void>;
  deleteNotebook(id: string): Promise<void>;

  // Sources
  addSource(notebookId: string, source: Source): Promise<void>;
  removeSource(notebookId: string, sourceId: string): Promise<void>;

  // Chat
  getChatHistory(notebookId: string): Promise<ChatMessage[]>;
  addChatMessage(notebookId: string, message: ChatMessage): Promise<void>;

  // Sync hooks (no-op in local implementation)
  sync?(): Promise<SyncResult>;
  onSyncConflict?(handler: ConflictHandler): void;
}
```

### API Integration (Vercel AI SDK)

```typescript
import { generateText, streamText } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { chromeai } from 'chrome-ai';  // Community package

// Provider factory
function getProvider(settings: AISettings) {
  switch (settings.provider) {
    case 'anthropic':
      return anthropic(settings.model);
    case 'openai':
      return openai(settings.model);
    case 'google':
      return google(settings.model);
    case 'chrome':
      return chromeai();
  }
}
```

---

## Implementation Phases

### Phase 1: Core Foundation
- [x] Project setup (TypeScript, Vite, CRXJS)
- [x] Manifest V3 with optional permissions
- [x] Side panel UI scaffold
- [x] Basic notebook and source management (chrome.storage)
- [x] Content extraction from active tab
- [ ] Migrate storage to IndexedDB with StorageAdapter interface
- [ ] Settings panel with API key storage
- [ ] Vercel AI SDK integration
- [ ] Basic chat/query functionality

### Phase 2: Source Management
- [ ] Tab picker (requires `tabs` permission)
- [ ] Bookmark browser (requires `bookmarks` permission)
- [ ] History search (requires `history` permission)
- [ ] Manual URL fetching
- [ ] Raw text input
- [ ] Improved content extraction (Readability.js)

### Phase 3: Enhanced AI Features
- [ ] Multi-provider support (Anthropic, OpenAI, Gemini)
- [ ] Chrome Built-in AI integration
- [ ] Streaming responses
- [ ] Source citations
- [ ] Context management for large notebooks
- [ ] Offline support (cache AI responses in IndexedDB)

### Phase 4: Transformations
- [ ] Summarization (single and multi-source)
- [ ] Quiz generation with interactive mode
- [ ] Export functionality (markdown, JSON)

### Phase 5: Podcast Generation
- [ ] Conversational script generation
- [ ] TTS provider integration
- [ ] Audio generation and merging
- [ ] Playback UI
- [ ] Download functionality

### Phase 6: Polish & Launch
- [ ] Error handling and edge cases
- [ ] Loading states and progress indicators
- [ ] Onboarding flow
- [ ] Chrome Web Store listing
- [ ] Documentation

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
- Notebooks, sources, and extracted content
- Chat history and AI responses (cached for offline)
- Generated audio files
- User settings and API keys

### Offline Support
Cache AI responses in IndexedDB for offline viewing:
- Previous chat messages viewable offline
- Generated summaries, quizzes cached locally
- Chrome Built-in AI works fully offline

### Sync Strategy
Design with sync hooks for future server-based sync:
- Abstract storage layer with `SyncableStorage` interface
- Each entity has `localId`, `remoteId`, `syncStatus`, `lastSynced`
- Sync operations: `push()`, `pull()`, `resolveConflict()`
- Server sync implementation deferred to future phase

### Sharing
Future consideration - not in initial scope.

### Podcast Files
Local-only storage and playback. No hosting/publishing feature.

---

## Appendix: Chrome Built-in AI

Chrome's built-in AI (Gemini Nano) is available in Chrome 127+ with these APIs:
- `window.ai.languageModel` - Text generation
- `window.ai.summarizer` - Summarization
- `window.ai.writer` - Writing assistance
- `window.ai.rewriter` - Text rewriting

Benefits:
- Free (no API costs)
- Fast (runs locally)
- Private (data doesn't leave device)
- Works offline

Limitations:
- Smaller model (less capable than cloud models)
- Limited context window
- Not available on all devices
- Requires Chrome flags to enable (for now)
