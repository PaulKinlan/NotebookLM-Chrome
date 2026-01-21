# FolioLM - Product Requirements Document

## Overview

FolioLM (https://foliolm.com) is a browser extension that helps users collect web content from tabs, bookmarks, and browsing history into notebooks, then query, summarize, and transform that content using AI.

## Problem Statement

Users frequently encounter valuable information across multiple web pages but lack an easy way to:
- Collect and organize content from different sources
- Query across multiple sources simultaneously
- Transform content into different formats (summaries, quizzes, podcasts)
- Capture multimodal content (images, video, audio, PDFs) alongside text
- Do all of this without leaving their browser

## Target Users

- Researchers gathering information from multiple sources
- Students studying topics across various websites
- Professionals conducting competitive analysis or market research
- Content creators looking to synthesize information
- Anyone who wants to learn from or summarize web content

---

## Roadmap

| Phase | Features | Priority | Status |
|-------|----------|----------|--------|
| Phase 1 | Text sources, notebooks, basic AI chat, transformations | P0 | Complete |
| Phase 2 | PDF support (local + web), improved content extraction | P1 | Planned |
| Phase 3 | Image extraction, multimodal AI context | P2 | Complete |
| Phase 4 | Video/Audio sources, expanded context menu | P3 | Planned |
| Future | Server sync, collaboration, mobile companion | P4 | Future |

---

## Core Features (P0)

### 1. Source Management

#### 1.1 Notebooks
- Create, rename, and delete notebooks
- Each notebook contains multiple sources
- Notebooks persist in IndexedDB (with sync hooks for future server sync)
- Active notebook tracked across sessions

**Acceptance Criteria:**
- [x] User can create a new notebook with a custom name
- [x] User can rename an existing notebook
- [x] User can delete a notebook and all its sources
- [x] Active notebook persists across browser sessions
- [x] Notebooks display source count

#### 1.2 Source Types

| Source Type | Permission Required | Description |
|-------------|---------------------|-------------|
| Current Tab | `activeTab` (required) | Add the currently active tab |
| Selected Tabs | `activeTab` (required) | Add multiple highlighted/selected tabs at once |
| Open Tabs | `tabs` (optional) | Browse and select from all open tabs via picker |
| Tab Groups | `tabs` + `tabGroups` (optional) | Import all tabs from a Chrome tab group |
| Bookmarks | `bookmarks` (optional) | Browse and select from bookmarks via picker |
| History | `history` (optional) | Search and select from browsing history via picker |
| Context Menu | `contextMenus` (required) | Right-click to add page or link |
| Notes | None | User-created text content |
| Page Images | `activeTab` (required) | Select and add images from the current page |

**Acceptance Criteria:**
- [x] User can add the current tab with one click
- [x] User can add multiple selected tabs simultaneously
- [x] User can browse and multi-select from open tabs
- [x] User can import all tabs from a tab group
- [x] User can browse and select bookmarks
- [x] User can search and select from history
- [x] Sources display title (with external link icon), URL, and initial icon
- [x] User can drag and drop links or text from web pages to add sources
- [x] User can create custom text notes as sources
- [x] User can select and add images from the current page via picker

#### 1.2.1 Drag and Drop Sources

Users can drag content from web pages directly into the side panel to add sources to their notebook:

**Supported Drop Content:**
| Content Type | Source Type Created | Description |
|--------------|---------------------|-------------|
| Links | `manual` | URLs dragged from web pages (preserves link title if available) |
| Text with URLs | `manual` | Text containing URLs - each URL is extracted and added as a link |
| Plain text | `text` | Text without URLs is added as a text source |

**Visual Feedback:**
- Full-screen drop zone overlay appears when dragging content over the side panel
- Pulsing border animation with accent color indicates valid drop target
- Upload icon bounces to provide clear visual guidance
- Overlay displays "Drop to add source" with helper text

**Behavior:**
- Multiple links can be dropped at once (e.g., from a selection containing multiple anchor tags)
- HTML content is parsed to extract links with their anchor text
- `text/uri-list` MIME type is supported for direct link drops
- Plain text URLs are automatically detected and extracted
- Drop is disabled when no notebook is selected (shows notification)

**Acceptance Criteria:**
- [x] User can drag a link from a web page and drop it in the side panel
- [x] User can drag multiple links (selected text with links) to add them all
- [x] User can drag plain text to add it as a text source
- [x] Visual drop zone overlay appears during drag
- [x] Notification confirms successful addition of sources

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

**Acceptance Criteria:**
- [x] Content is extracted as clean markdown
- [x] Navigation, ads, and boilerplate are removed
- [x] Extraction works on pages loaded before extension install
- [x] Failed extraction shows user-friendly error

#### 1.4 Refresh Sources

Sources can be refreshed to re-extract their content from the original URL. This is useful when web page content has been updated and users want to sync the latest version.

**Individual Source Refresh:**
- Small refresh button next to the "open in new tab" icon on each source
- Spinning animation during refresh
- Shows notification on success/failure
- Only available for URL-based sources (not manual/text sources)

**Batch Refresh All Sources:**
- Button in the "Active Sources" header
- Refreshes all URL-based sources in the current notebook sequentially
- Shows count of successfully refreshed sources
- Skips manual/text sources that cannot be refreshed

**Acceptance Criteria:**
- [x] Individual refresh button appears next to open-in-new-tab icon
- [x] Batch refresh button appears in Active Sources header
- [x] Refresh button shows spinning animation during operation
- [x] Manual/text sources do not show refresh button
- [x] User notification on refresh completion

### 2. AI Integration

#### 2.1 Provider Support
Uses the Vercel AI SDK (`npm:ai`) with provider packages:

| Provider | Package | Models | Use Case |
|----------|---------|--------|----------|
| Anthropic | `@ai-sdk/anthropic` | Claude 4.5 Sonnet, Opus, Haiku | High-quality reasoning and analysis |
| OpenAI | `@ai-sdk/openai` | GPT-5, GPT-5 Mini, GPT-5.1 Instant | General purpose, fast responses |
| Google | `@ai-sdk/google` | Gemini 2.5 Flash/Pro, Gemini 3 Pro/Flash (Preview) | Cost-effective, multimodal capable |
| Chrome Built-in | `@built-in-ai/core` | Gemini Nano | Offline, privacy-focused, free |

**Acceptance Criteria:**
- [x] User can select from multiple AI providers
- [x] User can choose specific models per provider
- [x] API keys are securely stored per provider
- [x] Test connection validates API key
- [x] Chrome Built-in AI works without API key

#### 2.2 Settings UI
- Model provider selection dropdown
- Model selection per provider
- API key input fields (stored in IndexedDB per provider)
- Test connection button
- Chrome Built-in AI works without API key

#### 2.3 Usage Statistics
Per-profile usage tracking with visual analytics:

**Features:**
- Track token usage (input/output) for every API call
- Calculate estimated cost based on model pricing
- View usage stats per AI profile via bar chart icon in settings
- Time range selector (day, week, month, quarter, year)
- Visual chart showing tokens per day and cost overlay
- Summary cards showing total tokens, cost, and request count

**Acceptance Criteria:**
- [x] Usage is tracked for all AI operations (chat, transforms, ranking, summarization)
- [x] Model pricing data is embedded in provider registry
- [x] Usage stats modal shows token usage chart
- [x] User can switch between time ranges
- [x] Estimated costs are calculated when pricing is available
- [x] Usage data persists in chrome.storage.local

#### 2.4 Context Management
- Combine source content into context for queries
- Source attribution in prompts
- Streaming responses for real-time feedback

**Acceptance Criteria:**
- [x] All notebook sources are included in AI context
- [x] Sources are attributed in prompts for citation
- [x] Responses stream in real-time
- [x] Large context is handled gracefully

### 3. Query & Chat

#### 3.1 Chat Interface
- Query input in the side panel
- Streaming responses with live updates
- Source-aware context building
- Basic markdown rendering in responses
- **Chat history persistence** (stored per-notebook in IndexedDB)
- **Clear chat history** button to reset conversation
- **Source citations** with inline [Source N] markers
- **Clickable citation cards** that open source URL with text fragment highlighting
- **Offline response caching** - cached responses used when offline or API fails

**Acceptance Criteria:**
- [x] User can type and submit queries
- [x] Responses stream with visible progress
- [x] Markdown renders correctly (headers, lists, code)
- [x] Chat history persists per notebook
- [x] User can clear chat history
- [x] Citations link to source with text highlighting

#### 3.2 Query Types
- Open-ended questions about sources
- Comparison queries ("How does X differ from Y?")
- Fact extraction ("What are the key dates mentioned?")
- Synthesis ("Combine these perspectives on...")

#### 3.3 Citation System
The AI is instructed to cite sources using `[Source N]` markers. After the response, a structured citations section is parsed:
- Citations extracted from response metadata
- Displayed as clickable cards below the response
- Clicking opens the source URL with Chrome's text fragment highlighting (`#:~:text=...`)

**Acceptance Criteria:**
- [x] AI responses include [Source N] citations
- [x] Citation cards display source title and excerpt
- [x] Clicking citation opens source URL
- [x] Text fragment highlighting works when available

#### 3.4 Suggested Links
AI-powered link discovery that analyzes links within source content and suggests relevant ones to add:

- **Link Extraction:** When sources are added, links are extracted from the HTML content before markdown conversion
  - Captures URL, anchor text, and surrounding context for each link
  - Filters out common noise URLs (privacy policies, login pages, social media, etc.)
  - Deduplicates links across sources

- **AI Filtering:** Links are analyzed by AI to identify the most relevant ones
  - Filters out low-value links (navigation, ads, boilerplate)
  - Scores remaining links by relevance to the notebook's topic (0-1 scale)
  - Returns top 10 most relevant links with title, description, and relevance score

- **Collapsible UI Section:** Displayed in the Chat tab below Active Sources
  - Shows count of suggested links
  - Each link shows title (with external link icon), AI-generated description, domain, and relevance score
  - External link icon next to title for quick access to open in new tab
  - "Add" button to add link as a new source
  - Refresh button to re-analyze links
  - Cache automatically invalidated when new sources are added

**Acceptance Criteria:**
- [x] Links are extracted from source content during extraction
- [x] Links are extracted even when using fallback extraction (pages loaded before extension install)
- [x] Noise URLs are filtered out using heuristic patterns
- [x] AI analyzes and ranks links by relevance
- [x] Suggested Links section shows in Chat tab when sources have links
- [x] User can open suggested links in new tab via external link icon
- [x] User can add suggested links as sources with one click
- [x] Suggestions are cached per notebook and invalidated when sources change

---

## Enhanced Features (P1-P2)

### 4. Transformations

19 transformation types accessible from the Transform tab, each with configurable options:

#### 4.1 Podcast Script
- Generate conversational dialogue between configurable number of speakers
- Hosts discuss and explain the source content
- Configurable: length (1-30 min), tone, speaker count (2-3), speaker names, focus area

**Acceptance Criteria:**
- [x] Generated script has distinct host voices
- [x] Content accurately reflects sources
- [x] User can copy the generated script
- [x] User can configure transformation settings

#### 4.2 Study Quiz
- Multiple choice and true/false questions
- Questions with options and explanations
- Configurable: question count (1-20), difficulty, question types, explanations toggle

**Acceptance Criteria:**
- [x] Questions are relevant to source content
- [x] Supports multiple question types
- [x] Correct answer and explanation are provided
- [x] User can configure difficulty and count

#### 4.3 Key Takeaways
- Extract the most important bullet points
- Formatted as a clear, actionable list
- Configurable: point count (3-15), format (bullets/numbered/paragraphs), include details toggle

**Acceptance Criteria:**
- [x] Takeaways capture main points from sources
- [x] Formatted as scannable list
- [x] User can copy takeaways
- [x] User can configure format and count

#### 4.4 Email Summary
- Professional email summary for sharing
- Includes key findings and structure
- Configurable: tone (formal/casual/professional), length, call-to-action toggle, recipient context

**Acceptance Criteria:**
- [x] Summary is professional and well-structured
- [x] Includes subject line suggestion
- [x] User can copy to clipboard
- [x] User can configure tone and length

#### 4.5 Additional Transformations
15 more transformation types with custom configurations:

| Type | Description | Key Config Options |
|------|-------------|-------------------|
| Slide Deck | Presentation slides with speaker notes | Slide count, style, speaker notes toggle |
| Report | Structured report in various formats | Format (academic/business/technical), sections, length |
| Data Table | Tabular data extraction | Max columns/rows, summary row toggle |
| Mind Map | Hierarchical concept mapping | Max depth, nodes per branch, layout |
| Flashcards | Study cards with Q&A format | Card count, difficulty, card style, hints toggle |
| Timeline | Chronological event listing | Layout, max events, descriptions toggle |
| Glossary | Term definitions with examples | Definition length, examples toggle, sort order |
| Comparison | Side-by-side comparison analysis | Max items, format, recommendation toggle |
| FAQ | Frequently asked questions | Question count, answer length, grouping |
| Action Items | Extracted tasks and to-dos | Priority format, timeframes, category grouping |
| Executive Brief | Concise decision-maker summary | Length, sections, focus area |
| Study Guide | Interactive HTML study material | Depth, sections, audience level |
| Pros & Cons | Balanced advantage/disadvantage analysis | Format, neutral points toggle, assessment |
| Citations | Formatted source citations | Citation styles (APA/MLA/Chicago/etc), annotations |
| Outline | Hierarchical document outline | Max depth, numbering style, descriptions |

#### 4.6 Transformation Configuration System

Each transformation supports custom configuration through a settings popover:

**Configuration Features:**
- Cog icon on each transformation card opens configuration popover
- Form fields dynamically generated based on transformation type
- Custom Instructions text area for user-defined prompt additions
- "Advanced" collapsible section shows prompt structure information
- Reset to Defaults button restores original settings
- Settings persist in chrome.storage.local per transformation type

**Acceptance Criteria:**
- [x] Each transformation has a config button (cog icon)
- [x] Config popover uses HTML Popover API
- [x] Settings are saved and loaded from storage
- [x] Custom instructions are injected into AI prompts
- [x] Advanced section shows prompt structure details
- [x] Reset restores default configuration

#### 4.6.1 Multimodal Transform Support

Transformations support image sources when using vision-capable AI providers (Anthropic Claude, OpenAI GPT-4o/V, Google Gemini, etc.).

**How It Works:**
- When image sources are present and the provider supports vision, images are sent alongside text
- The AI can analyze visual content and incorporate it into the transformation
- For quizzes: Questions can be about visual content
- For summaries/takeaways: Insights from images are included
- For slide decks: Visual content can be referenced

**Currently Multimodal-Enabled Transforms:**
All 19 transforms now support multimodal image analysis:
- Summary
- Key Takeaways
- Study Quiz
- Slide Deck
- Study Guide
- Podcast Script
- Email Summary
- Report
- Flashcards
- Data Table
- Mind Map
- Timeline
- Glossary
- Comparison
- FAQ
- Action Items
- Executive Brief
- Pros & Cons
- Citation List
- Outline

**Acceptance Criteria:**
- [x] Images are extracted from sources when provider supports vision
- [x] Multimodal message format used for vision-capable providers
- [x] Text-only fallback for providers without vision support
- [x] System prompts instruct AI to analyze visual content

#### 4.7 Transform Persistence & Management

Each generated transform result can be saved, deleted, or opened in a new tab for full-screen viewing. **Transform history is per-notebook** - when switching between folios, the Transform tab shows only the saved transforms for that specific folio.

**Features:**
- **Save Transform**: Click the save icon to persist a generated transform to IndexedDB storage. Saved transforms are associated with the notebook and can be accessed later.
- **Delete Transform**: Click the delete/close icon to remove a transform from the list. If the transform was saved, it is also deleted from storage.
- **Open in New Tab**: Click the external link icon to open the transform content in a new browser tab, enabling full-screen viewing. This is especially useful for interactive content like slides, quizzes, and mind maps that benefit from more screen space.
- **Per-Notebook Transform History**: Switching notebooks clears the Transform tab and loads saved transforms for the newly selected notebook. Unsaved transforms are cleared when switching.

**UI Changes:**
- Transform result card header now includes four action buttons (left to right):
  - Save (floppy disk icon) - Persists to storage, icon fills when saved
  - Open in new tab (external link icon) - Opens full-screen view
  - Copy (clipboard icon) - Copies content to clipboard
  - Remove/Delete (X or trash icon) - Removes card and deletes from storage if saved
- Saved transforms show a green border indicator
- Save button changes to filled icon and "Saved" tooltip after saving
- Close button changes to trash icon and "Delete" tooltip after saving

**Acceptance Criteria:**
- [x] Save button persists transform content to IndexedDB storage
- [x] Saved transforms show visual indicator (green border, filled save icon)
- [x] Delete button removes from both UI and storage
- [x] Open in new tab creates blob URL and opens in new Chrome tab
- [x] Interactive content (quizzes, slides, etc.) renders correctly in new tab
- [x] Markdown content is rendered with proper styling in new tab
- [x] Blob URLs are cleaned up after tab opens to prevent memory leaks
- [x] Transform history is per-notebook (switching notebooks loads saved transforms for that notebook)

#### 4.8 Concurrent Transforms & Background Execution

Users can start multiple transformations simultaneously without waiting for previous ones to complete. Each transform runs independently in the background service worker and displays its progress in the transform history.

**Background Execution:**
Transformations run in the background service worker, allowing them to continue even when the side panel is closed:
- **Persistent State**: Pending transforms are saved to IndexedDB, surviving side panel close/reopen
- **Automatic Resume**: When the side panel reopens, it syncs with any transforms that completed while closed
- **Service Worker Restart**: On service worker restart, any interrupted transforms are automatically resumed
- **Message Passing**: Side panel communicates with background via chrome.runtime messages (START_TRANSFORM, TRANSFORM_PROGRESS, TRANSFORM_COMPLETE, etc.)

**Features:**
- **Queue Multiple Transforms**: Users can click on multiple transform type buttons without waiting for previous transforms to finish
- **Pending Transform Display**: Each in-progress transform shows in the transform history with a spinning indicator and "Generating..." message
- **Independent Completion**: Each transform completes independently and is added to history when done
- **Error Isolation**: If one transform fails, others continue running unaffected
- **Survivable Execution**: Transforms continue running even if the side panel is closed

**UI Changes:**
- Section title shows count of generating transforms when any are pending (e.g., "Transforms (2 generating...)")
- Pending transform cards appear at the top of the history list with:
  - Dashed purple border to distinguish from completed transforms
  - Spinning progress indicator in the header
  - "Generating [type]..." message in the content area
  - Start time displayed in the metadata

**Acceptance Criteria:**
- [x] Multiple transforms can be initiated while others are in progress
- [x] Each pending transform displays with loading indicator
- [x] Completed transforms are added to history in completion order
- [x] Failed transforms are removed from pending without affecting others
- [x] `pendingTransforms` signal tracks all in-progress transforms
- [x] `pending` property exposed from useTransform hook
- [x] Transforms continue running when side panel is closed
- [x] Pending transforms persist to IndexedDB
- [x] Side panel syncs with background state on open

### 5. Multimodal Sources

#### 5.1 PDF Documents (P1)

| Source Type | Permission Required | Description |
|-------------|---------------------|-------------|
| PDF (Local) | none | Upload PDFs from computer via file picker |
| PDF (Web) | `activeTab` | Extract from PDF links on web pages |

**Features:**
- Local PDF upload via file picker in Add Sources screen
- Detect and extract PDFs linked on current page
- Text extraction using PDF.js library
- Store extracted text in `Source.content`
- Original PDF reference stored in metadata

**Acceptance Criteria:**
- [ ] User can upload PDF from local computer
- [ ] User can add PDF links from current page
- [ ] Text content is extracted accurately
- [ ] Multi-page PDFs are fully extracted
- [ ] PDF metadata (title, pages) is captured
- [ ] Error shown for encrypted/protected PDFs

#### 5.2 Images (P2)

| Source Type | Permission Required | Description |
|-------------|---------------------|-------------|
| Page Images | `activeTab` | Extract images from current page |
| Context Menu | `contextMenus` | Right-click image to add |

**Features:**
- **Auto-detection**: Identify important images on page (large, in-content, not UI/ads)
- **Image picker**: Modal to browse and select images from page
- **Hybrid mode**: Auto-suggest important images, user can modify selection
- **Context menu**: Right-click any image → "Add image to Notebook"
- **Storage**: Image URL stored, fetched for multimodal AI context

**Image Detection Heuristics:**
- Minimum dimensions (e.g., 200x200px)
- Within main content area (not header/footer/sidebar)
- Not common UI elements (icons, avatars, buttons)
- Has meaningful alt text or is figure/infographic

**Acceptance Criteria:**
- [x] User can view images detected on current page
- [ ] Auto-detection filters out UI/ad images (currently size-based only)
- [x] User can manually select/deselect images
- [x] Right-click adds single image to notebook
- [x] Images display as thumbnails in source list
- [x] Images are sent to multimodal AI providers

#### 5.3 Video Content (P3)

| Source Type | Permission Required | Description |
|-------------|---------------------|-------------|
| Web Video | `activeTab` | Video files linked from pages |
| Embedded Video | `activeTab` | YouTube, Vimeo, and other embeds |
| Context Menu | `contextMenus` | Right-click video to add |

**Features:**
- Detect video elements and embeds on current page
- Extract video URL, thumbnail, title, duration
- Context menu: Right-click video → "Add video to Notebook"
- Store as media reference for multimodal AI analysis
- Support for common platforms: YouTube, Vimeo, HTML5 video

**Acceptance Criteria:**
- [ ] User can add videos from current page
- [ ] YouTube/Vimeo embeds are detected
- [ ] HTML5 video elements are detected
- [ ] Video thumbnail displays in source list
- [ ] Video metadata (title, duration) is captured
- [ ] Right-click context menu works on videos

#### 5.4 Audio Content (P3)

| Source Type | Permission Required | Description |
|-------------|---------------------|-------------|
| Audio Files | `activeTab` | Audio linked from pages (MP3, WAV, etc.) |
| Podcast Embeds | `activeTab` | Embedded audio players |
| Context Menu | `contextMenus` | Right-click audio to add |

**Features:**
- Detect audio elements on current page
- Extract audio URL, title, duration
- Context menu: Right-click audio → "Add audio to Notebook"
- Store as media reference for multimodal AI
- Support for HTML5 audio, podcast embeds

**Acceptance Criteria:**
- [ ] User can add audio from current page
- [ ] HTML5 audio elements are detected
- [ ] Audio metadata (title, duration) is captured
- [ ] Audio displays in source list with icon
- [ ] Right-click context menu works on audio

---

## Advanced Features (P3+)

### 6. Keyboard Commands

Chrome keyboard shortcuts for quick actions:

| Shortcut | Mac Shortcut | Action |
|----------|--------------|--------|
| `Ctrl+Shift+F` | `Cmd+Shift+F` | Open FolioLM side panel |
| `Ctrl+Shift+S` | `Cmd+Shift+S` | Add current page to active notebook |
| `Ctrl+Shift+N` | `Cmd+Shift+N` | Create a new notebook |
| `Ctrl+Shift+E` | `Cmd+Shift+E` | Add selected text as a source |

**Behavior:**
- All commands open the side panel
- If no active notebook exists, prompts to create one first
- Shortcuts can be customized in `chrome://extensions/shortcuts`

**Acceptance Criteria:**
- [x] Open side panel shortcut works
- [x] Add page shortcut extracts and adds current tab
- [x] Create notebook shortcut triggers new notebook flow
- [x] Add selection shortcut captures highlighted text as source
- [x] Graceful handling when no notebook exists

### 7. Context Menu Integration

Right-click context menu for quick source addition:

| Menu Item | Context | Action |
|-----------|---------|--------|
| "Add page to Notebook" | Any page | Extract and add page content |
| "Add link to Notebook" | Any link | Open URL, extract content, close tab |
| "Add image to Notebook" | Any image | Add image to notebook for multimodal context |
| "Add video to Notebook" | Any video | Add video reference to notebook |
| "Add audio to Notebook" | Any audio | Add audio reference to notebook |

**Behavior:**
- Opens side panel after adding (or if no notebook selected)
- Shows success/error notification

**Acceptance Criteria:**
- [x] "Add page" extracts and adds current page
- [x] "Add link" opens, extracts, and closes background tab
- [x] "Add image" appears on right-click over images
- [ ] "Add video" appears on right-click over videos
- [ ] "Add audio" appears on right-click over audio
- [x] Side panel opens after adding source

### 8. Multi-Tab Selection

When multiple tabs are highlighted in the browser:
- Button automatically changes from "Add Current Tab" to "Add X Selected Tabs"
- Clicking adds all selected tabs to the notebook
- Updates dynamically as tab selection changes

**Acceptance Criteria:**
- [x] Button text updates based on selection count
- [x] All selected tabs are added simultaneously
- [x] Progress indicator shows extraction status

---

## User Interface

**Design Assets:** See `/designs/` folder for visual mockups.

**Theme:** Light and dark mode UI with blue accent colors. Users can choose light, dark, or system preference.

**Tech Stack:** Preact (3kb React-like library) with TypeScript, CSS with variables.

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
| Import Options | Card-style buttons with picker modals: |
| | - **Select from Open Tabs** - Multi-select picker |
| | - **Import from Tab Groups** - Select tab group(s) to import |
| | - **Add from Bookmarks** - Bookmark browser picker |
| | - **Add from History** - History search picker |
| | - **Upload PDF** - File picker for local PDFs (P1) |
| | - **Add Images from Page** - Image picker modal (P2) |
| Recent Sources | Previously added sources with title, domain, remove button |

### Chat Screen
`designs/notebook_summary_&_query/screen.png`

| Element | Description |
|---------|-------------|
| Notebook Selector | Dropdown to select/create notebooks |
| Query Input | Search field: "Ask a question about your sources..." with submit button |
| Helper Text | "Ask questions to synthesize information from your active sources below" |
| Active Sources | List of sources with initial icon, title (with external link icon), domain, remove button |
| Add Current Page | Button to quickly add the current tab |
| Clear Chat | Button to clear chat history for the current notebook |
| Chat Messages | Scrollable message history with user questions and assistant responses |
| AI Response | Streaming markdown content with inline [Source N] citations |
| Citation Cards | Clickable cards showing source title + excerpt, links to source with text fragment highlighting |
| Offline Indicator | Shows when cached response is used (offline or API error) |

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
| Result Panel | Generated content with save/open-in-new-tab/copy/delete action buttons |

### Picker Modal
Shared modal for tabs, bookmarks, history, and media selection:

| Element | Description |
|---------|-------------|
| Header | Title (e.g., "Select Tabs", "Select Images") with close button |
| Search | Filter input to search items |
| Item List | Scrollable list with checkbox, favicon/thumbnail, title, URL |
| Footer | Selected count + Cancel/Add Selected buttons |

### Settings Panel
- **Appearance** - Theme selection (Light, Dark, System)
- AI Provider selection (Anthropic, OpenAI, Google, Chrome Built-in)
- Model selection dropdown (updates per provider)
- API key input (hidden for Chrome Built-in)
- Test connection button
- Permission toggles (Tabs, Tab Groups, Bookmarks, History)

---

## Technical Architecture

### Extension Components

```
┌─────────────────────────────────────────────────────────┐
│                    Chrome Extension                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Side Panel  │  │   Background    │  │   Content   │ │
│  │  (Preact)   │◄─┤    Worker       ├─►│   Script    │ │
│  │             │  │                 │  │ (Turndown)  │ │
│  │  - Chat UI  │  │ - Extraction    │  │             │ │
│  │  - Sources  │  │ - Context menus │  └─────────────┘ │
│  │  - History  │  │ - Transforms*   │                   │
│  └─────────────┘  └───────┬─────────┘                   │
│         │                 │                              │
│         │ (sync on open)  │ (execute transforms)        │
│         │                 │                              │
│         └────────►┌───────▼──────┐◄─────────────────────┘
│                   │  IndexedDB   │                       │
│                   │  (Storage)   │                       │
│                   │ backgroundTransforms store          │
│                   └──────────────┘                       │
└─────────────────────────────────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │     AI Providers        │
              │  (Vercel AI SDK)        │
              │  Anthropic, OpenAI,     │
              │  Google, Chrome Built-in│
              └─────────────────────────┘

* Transforms run in background worker, surviving side panel close
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
│   ├── pdf.ts            # PDF extraction (P1)
│   ├── media.ts          # Image/video/audio detection (P2-P3)
│   └── storage.ts        # StorageAdapter implementation
├── sidepanel/
│   ├── index.html        # Side panel UI structure
│   ├── main.tsx          # Preact render entry point
│   ├── App.tsx           # Root component with hooks
│   ├── index.ts          # Re-exports hooks and services
│   ├── hooks/            # Custom Preact hooks for state management
│   │   ├── index.ts      # Hooks barrel export
│   │   ├── useNavigation.ts
│   │   ├── useNotification.ts
│   │   ├── useDialog.ts
│   │   ├── useNotebook.ts
│   │   ├── useSources.ts
│   │   ├── useChat.ts
│   │   ├── usePermissions.ts
│   │   ├── useToolPermissions.ts
│   │   ├── useTransform.ts
│   │   ├── usePickerModal.ts
│   │   └── useOnboarding.ts
│   ├── services/         # Business logic layer
│   │   ├── notebooks.ts  # Notebook CRUD operations
│   │   ├── permissions.ts # Chrome permissions helpers
│   │   ├── sources.ts     # Source import functions
│   │   └── ui.ts         # UI helpers
│   ├── components/       # Preact UI components
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

interface ExtractedLink {
  url: string;
  text: string;      // Anchor text
  context: string;   // Surrounding text for context (~50 chars)
}

interface SuggestedLink {
  url: string;
  title: string;           // AI-inferred or extracted title
  description: string;     // Why this link is relevant
  relevanceScore: number;  // 0-1 score from AI
  sourceId: string;        // Which source this link came from
  sourceTitle: string;     // Title of the source for attribution
}

interface Source extends SyncableEntity {
  notebookId: string;
  type: 'tab' | 'bookmark' | 'history' | 'manual' | 'text' | 'note' | 'pdf' | 'image' | 'video' | 'audio';
  url: string;
  title: string;
  content: string; // Text content (empty for media-only sources)
  links?: ExtractedLink[];  // Links extracted from the source content
  mediaType?: 'text' | 'image' | 'video' | 'audio' | 'pdf';
  mediaUrl?: string; // URL or blob URL for media content
  metadata?: {
    favicon?: string;
    description?: string;
    wordCount?: number;
    // Media-specific fields
    mimeType?: string;
    fileSize?: number;
    duration?: number; // For video/audio in seconds
    dimensions?: { width: number; height: number }; // For images/video
    thumbnail?: string; // Thumbnail URL for video/images
    pageCount?: number; // For PDFs
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

interface Citation {
  sourceId: string;
  sourceTitle: string;
  excerpt: string;
}

interface CachedResponse {
  id: string;              // hash of query + sourceIds
  notebookId: string;
  query: string;
  sourceIds: string[];
  response: string;
  citations: Citation[];
  createdAt: number;
}

interface Transformation extends SyncableEntity {
  notebookId: string;
  type: TransformationType; // 19 types: podcast, quiz, takeaways, email, slidedeck, report, datatable, mindmap, flashcards, timeline, glossary, comparison, faq, actionitems, executivebrief, studyguide, proscons, citations, outline
  title: string;
  content: string;
  sourceIds: string[];
}

// Background transform for service worker execution
type BackgroundTransformStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

interface BackgroundTransform {
  id: string;
  type: TransformationType;
  notebookId: string;
  sourceIds: string[];
  status: BackgroundTransformStatus;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  content?: string;       // Generated content (if completed)
  error?: string;         // Error message (if failed)
  progress?: number;      // Progress indicator (0-100)
}

// Configuration stored per transformation type
interface TransformConfig {
  customInstructions?: string; // User-defined prompt additions
  // Type-specific options vary per transformation
}

interface AISettings {
  provider: 'anthropic' | 'openai' | 'google' | 'chrome';
  model: string;
  apiKeys: Record<string, string>;  // Per-provider API keys
}

// Usage tracking for API cost monitoring
interface UsageRecord {
  id: string;
  modelConfigId: string;          // References ModelConfig.id
  providerId: string;             // Provider ID for pricing lookup
  model: string;                  // Model ID used
  inputTokens: number;            // Prompt tokens
  outputTokens: number;           // Completion tokens
  totalTokens: number;            // Total tokens
  cost?: number;                  // Calculated cost in USD
  timestamp: number;              // When the API call was made
  operation: 'chat' | 'transform' | 'ranking' | 'summarization' | 'test';
}

interface UsageStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  totalCost: number;
  requestCount: number;
  records: UsageRecord[];
}

type UsageTimeRange = 'day' | 'week' | 'month' | 'quarter' | 'year';
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

### Completed (P0)
- [x] Project setup (TypeScript, Vite, CRXJS)
- [x] Manifest V3 with optional permissions
- [x] **Hooks-based architecture** (Preact hooks for state management)
- [x] **Service layer** (business logic separated from UI)
- [x] Side panel UI with light/dark theme support (user preference)
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
- [x] Transform persistence & management (save, delete, open in new tab)
- [x] Settings panel with per-provider API keys
- [x] Tab picker modal with multi-select
- [x] Bookmark picker modal
- [x] History picker modal
- [x] Context menu (Add page, Add link)
- [x] Multi-tab selection support
- [x] Permission request flow
- [x] Tab Groups picker (import all tabs from a tab group)
- [x] Source citations in chat responses (inline [Source N] references + clickable citation cards)
- [x] Citation click-to-source with text fragment highlighting
- [x] Chat history persistence (per-notebook, stored in IndexedDB)
- [x] Clear chat history functionality
- [x] Offline caching of AI responses (fall back to cached responses when offline or API errors)
- [x] Basic markdown rendering in chat responses
- [x] Keyboard shortcuts for quick actions (Ctrl+Shift+F/S/N/E)
- [x] Source refresh (individual and batch) to re-extract content from URLs
- [x] **Unit tests** (useDialog hook with promise resolution and listener cleanup)

### Phase 2 - PDF Support (P1)
- [ ] PDF.js integration for text extraction
- [ ] Local PDF upload via file picker
- [ ] Web PDF link detection and extraction
- [ ] PDF metadata capture (title, page count)
- [ ] Error handling for encrypted PDFs

### Phase 3 - Image Support (P2)
- [x] Image detection on current page
- [x] Size-based image filtering (100x100px minimum)
- [ ] Content-aware filtering (exclude UI/ads based on position/context)
- [x] Image picker modal UI with select all/deselect all
- [x] Context menu: "Add image to Notebook"
- [x] Image thumbnail display in source list
- [x] Multimodal AI context building with images

### Phase 4 - Video/Audio Support (P3)
- [ ] Video element detection (HTML5, YouTube, Vimeo)
- [ ] Audio element detection
- [ ] Context menu: "Add video to Notebook"
- [ ] Context menu: "Add audio to Notebook"
- [ ] Media metadata capture (duration, thumbnail)
- [ ] Media display in source list

### Future Enhancements
- [ ] Improved content extraction (Readability.js fallback)
- [ ] Audio generation for podcast scripts (TTS integration)
- [ ] Export functionality (markdown, JSON export)
- [x] Onboarding flow (first-time user experience, includes Chrome AI model auto-download)
- [ ] Error handling polish (better messages, retry logic)
- [ ] Chrome Web Store listing (icons, screenshots, description)
- [ ] Server sync implementation
- [ ] Collaboration features
- [ ] Mobile companion app

---

## Success Metrics

- Sources added per notebook (target: avg 5+)
- Queries per session (target: avg 3+)
- Transformation usage rate
- User retention (weekly active users)
- Chrome Web Store rating
- **Multimodal source adoption** (% of notebooks with non-text sources)
- **PDF sources per user** (target: avg 2+ for research users)

---

## Architecture Decisions

### Storage: IndexedDB
All data stored in IndexedDB with `unlimitedStorage` permission for unlimited local storage capacity:
- `unlimitedStorage` permission removes Chrome's default 5MB storage limit
- Notebooks and sources stored separately (sources reference notebookId)
- Settings stored as key-value pairs
- Designed for future sync with SyncableEntity base type
- Media references stored as URLs (not blobs) to minimize storage

### Offline Support
- Chrome Built-in AI works fully offline (Gemini Nano)
- Sources and notebooks available offline (stored in IndexedDB)
- **Response caching**: AI responses are cached with their query and source IDs
- **Offline fallback**: When offline or API errors occur, cached responses are used
- **Cache key**: Deterministic hash of query + sorted source IDs ensures consistent cache hits
- Cloud AI providers require network for new queries

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

### Multimodal AI Strategy
- Text sources: All providers support text context
- Image sources: Google Gemini, OpenAI GPT-4V+ support images
- Video/Audio: Store references, use multimodal providers for analysis
- Graceful degradation: Text-only providers receive text description of media

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
- Text-only (no multimodal support)

**Model Download:**
- The Gemini Nano model (~1.5GB) is downloaded on-demand when first used
- Chrome requires a user gesture (click, keypress) to initiate the download
- FolioLM automatically triggers the download during onboarding when the user interacts with the UI
- Download progress is logged to the console; the download continues in the background
- If the model is already downloaded, no additional action is taken
