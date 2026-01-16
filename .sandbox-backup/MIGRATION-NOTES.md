# Sandbox Migration Notes

## Files to Apply

### 1. New Sandbox Files (sandbox-files.patch)
These are entirely new files that can be applied directly:
- `src/sandbox/fullscreen-sandbox.html`
- `src/sandbox/fullscreen-sandbox.ts`
- `src/sandbox/fullscreen-wrapper.html`
- `src/sandbox/fullscreen-wrapper.ts`

### 2. Config Changes (sandbox-config-changes.patch)
- `manifest.json` - adds web_accessible_resources for sandbox files
- `vite.config.ts` - adds build entries for new sandbox files

### 3. Controller Logic (sandbox-controllers-changes.patch)
This needs manual migration to the new hooks architecture:

#### Changes to migrate:
1. **loadTransformHistory()** calls added to:
   - `init()` function
   - `handleNotebookChange()` function
   - `selectNotebook()` function

2. **openTransformInNewTab()** function modified to:
   - Use chrome.tabs.sendMessage for interactive content
   - Open fullscreen-wrapper.html and send content via messaging
   - Keep blob URLs only for non-interactive markdown content

## Target Files in New Architecture
Look at these hooks to understand where sandbox logic should go:
- `src/sidepanel/hooks/useTransform.ts` - transform handling
- `src/sidepanel/hooks/useNotebook.ts` - notebook lifecycle

