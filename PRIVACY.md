# Privacy Policy for FolioLM

**Last Updated:** January 7, 2026

## Overview

FolioLM is a browser extension that helps you collect and query content from your browser tabs, bookmarks, and history. This privacy policy explains how your data is handled.

## Data Collection

**FolioLM does not collect, store, or transmit any of your data to the extension author or any servers operated by the author.** There is no analytics, telemetry, or tracking of any kind.

## Local Data Storage

All data you create within FolioLM (notebooks, sources, and extracted content) is stored locally in your browser using Chrome's `chrome.storage.local` API. This data:

- Never leaves your device unless you explicitly use AI features
- Is not accessible to the extension author
- Can be cleared at any time by removing the extension or clearing extension data

## Third-Party AI Services

FolioLM allows you to connect to third-party AI services to query and transform your content. These services include:

- **Anthropic** (Claude API) - https://www.anthropic.com/privacy
- **OpenAI** (GPT API) - https://openai.com/privacy
- **Google** (Gemini API) - https://policies.google.com/privacy

### Important Notes About AI Services

1. **Your API Keys**: You must provide your own API keys to use these services. FolioLM stores your API keys locally in your browser and only uses them to authenticate requests to the respective services.

2. **Data Sent to AI Services**: When you use AI features, the content you've collected (text from tabs, bookmarks, or history entries) is sent directly from your browser to the AI service you've configured. This communication happens directly between your browser and the AI provider—it does not pass through any servers operated by the FolioLM author.

3. **AI Provider Privacy Policies**: You are responsible for reviewing and accepting the privacy policies of any AI services you choose to use. Each provider has their own data handling practices, retention policies, and terms of service.

## Browser Permissions

FolioLM requests certain browser permissions to function:

### Required Permissions
- **storage**: To save your notebooks and settings locally
- **sidePanel**: To display the extension interface
- **activeTab**: To extract content from the currently active tab
- **scripting**: To extract text content from web pages
- **contextMenus**: To provide right-click menu options

### Optional Permissions (User-Granted)
- **tabs**: To access information about open tabs for adding sources
- **tabGroups**: To organize sources by tab groups
- **bookmarks**: To add bookmarked pages as sources
- **history**: To add pages from your browsing history as sources

These permissions are used solely to provide the extension's functionality and are not used for any tracking or data collection purposes.

## Data Security

- All data is stored locally using Chrome's built-in storage APIs
- API keys are stored locally and transmitted only to their respective AI services via HTTPS
- No data is ever sent to servers operated by the extension author

## Your Rights

You have complete control over your data:

- **Access**: All your data is stored locally and viewable within the extension
- **Deletion**: You can delete individual notebooks, sources, or all data by removing the extension
- **Portability**: Your data is stored locally on your device

## Children's Privacy

FolioLM is not directed at children under 13 years of age. We do not knowingly collect personal information from children.

## Changes to This Policy

If this privacy policy is updated, the changes will be reflected in the extension's repository and the "Last Updated" date will be modified.

## Contact

If you have questions about this privacy policy or the extension, please contact:

**Paul Kinlan**
Email: paul@aifoc.us

## Open Source

FolioLM is open source. You can review the complete source code to verify these privacy practices.
