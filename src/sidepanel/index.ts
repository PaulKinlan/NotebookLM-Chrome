import type { Notebook, Source, PermissionStatus } from '../types/index.ts';
import { checkPermissions, requestPermission } from '../lib/permissions.ts';
import {
  getNotebooks,
  saveNotebook,
  createNotebook,
  getActiveNotebookId,
  setActiveNotebookId,
  removeSourceFromNotebook,
} from '../lib/storage.ts';

const elements = {
  newNotebookBtn: document.getElementById('new-notebook-btn') as HTMLButtonElement,
  notebookSelect: document.getElementById('notebook-select') as HTMLSelectElement,
  sourcesPanel: document.getElementById('sources-panel') as HTMLElement,
  sourcesList: document.getElementById('sources-list') as HTMLUListElement,
  addCurrentTab: document.getElementById('add-current-tab') as HTMLButtonElement,
  addFromTabs: document.getElementById('add-from-tabs') as HTMLButtonElement,
  addFromBookmarks: document.getElementById('add-from-bookmarks') as HTMLButtonElement,
  querySection: document.getElementById('query-section') as HTMLElement,
  queryInput: document.getElementById('query-input') as HTMLTextAreaElement,
  queryBtn: document.getElementById('query-btn') as HTMLButtonElement,
  queryResult: document.getElementById('query-result') as HTMLElement,
  permTabs: document.getElementById('perm-tabs') as HTMLInputElement,
  permBookmarks: document.getElementById('perm-bookmarks') as HTMLInputElement,
  permHistory: document.getElementById('perm-history') as HTMLInputElement,
  permissionsSection: document.getElementById('permissions-section') as HTMLElement,
};

let currentNotebook: Notebook | null = null;
let permissions: PermissionStatus = { tabs: false, bookmarks: false, history: false };

async function init(): Promise<void> {
  permissions = await checkPermissions();
  updatePermissionUI();
  await loadNotebooks();
  setupEventListeners();
}

function setupEventListeners(): void {
  elements.newNotebookBtn.addEventListener('click', handleNewNotebook);
  elements.notebookSelect.addEventListener('change', handleNotebookChange);
  elements.addCurrentTab.addEventListener('click', handleAddCurrentTab);
  elements.addFromTabs.addEventListener('click', handleAddFromTabs);
  elements.addFromBookmarks.addEventListener('click', handleAddFromBookmarks);
  elements.queryBtn.addEventListener('click', handleQuery);

  elements.permTabs.addEventListener('change', () => handlePermissionToggle('tabs'));
  elements.permBookmarks.addEventListener('change', () => handlePermissionToggle('bookmarks'));
  elements.permHistory.addEventListener('change', () => handlePermissionToggle('history'));
}

function updatePermissionUI(): void {
  elements.permTabs.checked = permissions.tabs;
  elements.permBookmarks.checked = permissions.bookmarks;
  elements.permHistory.checked = permissions.history;

  elements.addFromTabs.disabled = !permissions.tabs;
  elements.addFromBookmarks.disabled = !permissions.bookmarks;
}

async function handlePermissionToggle(
  permission: 'tabs' | 'bookmarks' | 'history'
): Promise<void> {
  const granted = await requestPermission(permission);
  permissions = await checkPermissions();
  updatePermissionUI();

  if (!granted) {
    const checkbox = elements[`perm${permission.charAt(0).toUpperCase() + permission.slice(1)}` as keyof typeof elements] as HTMLInputElement;
    checkbox.checked = false;
  }
}

async function loadNotebooks(): Promise<void> {
  const notebooks = await getNotebooks();
  const activeId = await getActiveNotebookId();

  elements.notebookSelect.innerHTML = '<option value="">Select a notebook...</option>';

  for (const notebook of notebooks) {
    const option = document.createElement('option');
    option.value = notebook.id;
    option.textContent = notebook.name;
    elements.notebookSelect.appendChild(option);
  }

  if (activeId) {
    elements.notebookSelect.value = activeId;
    currentNotebook = notebooks.find((n) => n.id === activeId) ?? null;
    if (currentNotebook) {
      showNotebook(currentNotebook);
    }
  }
}

async function handleNewNotebook(): Promise<void> {
  const name = prompt('Enter notebook name:');
  if (!name) return;

  const notebook = createNotebook(name);
  await saveNotebook(notebook);
  await setActiveNotebookId(notebook.id);
  await loadNotebooks();
}

async function handleNotebookChange(): Promise<void> {
  const id = elements.notebookSelect.value;

  if (!id) {
    currentNotebook = null;
    elements.sourcesPanel.classList.add('hidden');
    elements.querySection.classList.add('hidden');
    await setActiveNotebookId(null);
    return;
  }

  const notebooks = await getNotebooks();
  currentNotebook = notebooks.find((n) => n.id === id) ?? null;

  if (currentNotebook) {
    await setActiveNotebookId(id);
    showNotebook(currentNotebook);
  }
}

function showNotebook(notebook: Notebook): void {
  elements.sourcesPanel.classList.remove('hidden');
  elements.querySection.classList.toggle('hidden', notebook.sources.length === 0);
  elements.permissionsSection.classList.remove('hidden');
  renderSources(notebook.sources);
}

function renderSources(sources: Source[]): void {
  elements.sourcesList.innerHTML = '';

  for (const source of sources) {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="source-title">${escapeHtml(source.title)}</div>
      <div class="source-url">${escapeHtml(source.url)}</div>
      <div class="source-actions">
        <button class="btn btn-remove" data-id="${source.id}">Remove</button>
      </div>
    `;
    elements.sourcesList.appendChild(li);
  }

  elements.sourcesList.querySelectorAll('.btn-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).dataset.id;
      if (id) handleRemoveSource(id);
    });
  });

  elements.querySection.classList.toggle('hidden', sources.length === 0);
}

async function handleAddCurrentTab(): Promise<void> {
  const response = await chrome.runtime.sendMessage({ type: 'EXTRACT_CONTENT' });

  if (response) {
    await chrome.runtime.sendMessage({ type: 'ADD_SOURCE', payload: response });
    await refreshCurrentNotebook();
  }
}

async function handleAddFromTabs(): Promise<void> {
  if (!permissions.tabs || !currentNotebook) return;

  const tabs = await chrome.tabs.query({});
  // TODO: Show tab picker dialog
  console.log('Available tabs:', tabs);
}

async function handleAddFromBookmarks(): Promise<void> {
  if (!permissions.bookmarks || !currentNotebook) return;

  const bookmarks = await chrome.bookmarks.getTree();
  // TODO: Show bookmark picker dialog
  console.log('Available bookmarks:', bookmarks);
}

async function handleRemoveSource(sourceId: string): Promise<void> {
  if (!currentNotebook) return;

  await removeSourceFromNotebook(currentNotebook.id, sourceId);
  await refreshCurrentNotebook();
}

async function refreshCurrentNotebook(): Promise<void> {
  if (!currentNotebook) return;

  const notebooks = await getNotebooks();
  currentNotebook = notebooks.find((n) => n.id === currentNotebook!.id) ?? null;

  if (currentNotebook) {
    renderSources(currentNotebook.sources);
  }
}

async function handleQuery(): Promise<void> {
  const query = elements.queryInput.value.trim();
  if (!query || !currentNotebook) return;

  elements.queryResult.textContent = 'Processing query...';

  // TODO: Implement actual query processing with AI
  const sourceSummary = currentNotebook.sources
    .map((s) => `- ${s.title}: ${s.content?.slice(0, 200) ?? 'No content'}...`)
    .join('\n');

  elements.queryResult.textContent = `Query: "${query}"\n\nSources:\n${sourceSummary}\n\n[AI response would go here]`;
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

init();
