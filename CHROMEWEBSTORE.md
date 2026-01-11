# Chrome Web Store Listing

**Last Updated:** January 11, 2026

This file contains all information needed for the Chrome Web Store listing. Update this file whenever the product changes, especially for permission changes, new features, or description updates.

---

## Store Listing

### Product Name
FolioLM

### Short Description (132 characters max)
Collect and query content from tabs, bookmarks, and history - your AI research companion

### Detailed Description

FolioLM helps you collect sources from tabs, bookmarks, and history, then query and transform that content using AI.

**Features:**

• Source Collection - Gather content from open tabs, bookmarks, browser history, or paste text manually

• AI-Powered Chat - Query your collected sources with natural language, with citations back to original content

• Multi-Provider Support - 16+ AI providers including Anthropic, OpenAI, Google, Groq, Mistral, and Chrome Built-in AI

• Flexible Configuration - Named credentials, per-notebook model overrides, and custom endpoints

• Transformations - Convert your sources into 19 different formats:
  - Educational: Quiz, Flashcards, Study Guide
  - Creative: Podcast Script, Email, Slide Deck
  - Analytical: Report, Timeline, Comparison, Data Table, Mind Map
  - Reference: Glossary, FAQ, Outline, Citations
  - Business: Action Items, Executive Brief, Key Takeaways, Pros/Cons

**Privacy First:**
All your data stays on your device. FolioLM does not collect, store, or transmit any data to our servers. When you use AI features, content is sent directly from your browser to the AI provider you configure - never through us.

**Bring Your Own API Keys:**
Use your own API keys from Anthropic, OpenAI, Google, or other providers. Chrome Built-in AI works without any API key.

### Category
Productivity

### Language
English

### Website
https://foliolm.com

### Privacy Policy URL
https://foliolm.com/privacy

---

## Permissions Justification

Copy these justifications when submitting to the Chrome Web Store. Each permission must be justified for the review process.

### Required Permissions

| Permission | Justification |
|------------|---------------|
| `storage` | Required to save user notebooks, sources, chat history, and settings locally in the browser. All data is stored on-device using IndexedDB. |
| `sidePanel` | Required to display the main extension interface as a Chrome side panel, where users manage notebooks, chat with AI, and configure settings. |
| `activeTab` | Required to extract text content from the currently active tab when the user clicks "Add current page" to add it as a source. |
| `scripting` | Required to inject the content extraction script into web pages to convert HTML to Markdown for source collection. |
| `contextMenus` | Required to provide right-click menu options for adding pages or selected links to notebooks. |

### Host Permissions

| Permission | Justification |
|------------|---------------|
| `<all_urls>` | Required to extract content from any web page the user wants to add as a source. Content extraction only occurs when explicitly triggered by user action. |

### Optional Permissions (User-Granted)

| Permission | Justification |
|------------|---------------|
| `tabs` | Enables listing all open tabs so users can select multiple tabs to add as sources at once. Only requested when the user accesses the "Tabs" source option. |
| `tabGroups` | Enables organizing sources by Chrome tab groups. Only requested alongside the tabs permission when the user accesses tab-based features. |
| `bookmarks` | Enables browsing and adding bookmarked pages as sources. Only requested when the user accesses the "Bookmarks" source option. |
| `history` | Enables searching browser history to add previously visited pages as sources. Only requested when the user accesses the "History" source option. |

### Remote Code Policy
This extension does not use any remotely hosted code. All JavaScript is bundled and included in the extension package.

### Data Usage Disclosure

**Data collected:** None - FolioLM does not collect any user data.

**Data used:**
- User-provided content (text from web pages) is processed locally and optionally sent to third-party AI providers chosen by the user
- API keys provided by users are stored locally and used only to authenticate with their respective AI services

**Data shared:**
- When users enable AI features, content is sent directly to the AI provider they configure (Anthropic, OpenAI, Google, etc.)
- No data is ever sent to servers operated by the extension developer

---

## Screenshots

Recommended screenshots for store listing:

1. **Main Interface** - Side panel showing notebook with sources and chat
2. **Source Collection** - Adding sources from tabs, bookmarks, or history
3. **AI Chat** - Querying sources with AI-powered responses and citations
4. **Transformations** - Converting sources to different formats (quiz, summary, etc.)
5. **Settings** - API key and model configuration interface

---

## Version History

### v0.2.0
- Context menu: Extract links from selected text on any webpage
- Smart source ranking: LLM-powered relevance scoring for better query results
- Model selection UI: Robot icon button for easier model switching
- Comprehensive test coverage: Added extensive unit tests for core modules
- Developer tooling: Semantic versioning script for consistent releases

### v0.1.0
- Initial release
- Source collection from tabs, bookmarks, history, and manual entry
- AI chat with 16+ provider support
- 19 transformation types
- Named credentials and model configuration
- Per-notebook model overrides

---

## Review Notes

Notes for Chrome Web Store reviewers:

1. **AI Features Require API Keys**: To test AI chat and transformations, you'll need an API key from one of the supported providers (Anthropic, OpenAI, Google, etc.), OR you can test with Chrome's Built-in AI which requires no API key.

2. **Optional Permissions**: The extension works with just the required permissions. Optional permissions (tabs, bookmarks, history) are only requested when the user tries to access those specific features.

3. **Content Extraction**: The `<all_urls>` host permission is required for content extraction, but extraction only occurs when the user explicitly adds a page as a source.

4. **No Account Required**: The extension is fully functional without any account or sign-up.
