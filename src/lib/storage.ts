import type { Notebook, Source } from '../types/index.ts';

const NOTEBOOKS_KEY = 'notebooks';
const ACTIVE_NOTEBOOK_KEY = 'activeNotebookId';

export async function getNotebooks(): Promise<Notebook[]> {
  const result = await chrome.storage.local.get(NOTEBOOKS_KEY);
  return result[NOTEBOOKS_KEY] ?? [];
}

export async function saveNotebook(notebook: Notebook): Promise<void> {
  const notebooks = await getNotebooks();
  const index = notebooks.findIndex((n) => n.id === notebook.id);

  if (index >= 0) {
    notebooks[index] = { ...notebook, updatedAt: Date.now() };
  } else {
    notebooks.push(notebook);
  }

  await chrome.storage.local.set({ [NOTEBOOKS_KEY]: notebooks });
}

export async function deleteNotebook(id: string): Promise<void> {
  const notebooks = await getNotebooks();
  const filtered = notebooks.filter((n) => n.id !== id);
  await chrome.storage.local.set({ [NOTEBOOKS_KEY]: filtered });
}

export async function getActiveNotebookId(): Promise<string | null> {
  const result = await chrome.storage.local.get(ACTIVE_NOTEBOOK_KEY);
  return result[ACTIVE_NOTEBOOK_KEY] ?? null;
}

export async function setActiveNotebookId(id: string | null): Promise<void> {
  await chrome.storage.local.set({ [ACTIVE_NOTEBOOK_KEY]: id });
}

export async function addSourceToNotebook(
  notebookId: string,
  source: Source
): Promise<void> {
  const notebooks = await getNotebooks();
  const notebook = notebooks.find((n) => n.id === notebookId);

  if (notebook) {
    notebook.sources.push(source);
    await saveNotebook(notebook);
  }
}

export async function removeSourceFromNotebook(
  notebookId: string,
  sourceId: string
): Promise<void> {
  const notebooks = await getNotebooks();
  const notebook = notebooks.find((n) => n.id === notebookId);

  if (notebook) {
    notebook.sources = notebook.sources.filter((s) => s.id !== sourceId);
    await saveNotebook(notebook);
  }
}

export function createNotebook(name: string): Notebook {
  return {
    id: crypto.randomUUID(),
    name,
    sources: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function createSource(
  type: Source['type'],
  url: string,
  title: string,
  content?: string
): Source {
  return {
    id: crypto.randomUUID(),
    type,
    url,
    title,
    content,
    addedAt: Date.now(),
  };
}
