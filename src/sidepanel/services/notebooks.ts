/**
 * Notebooks Service
 *
 * Business logic for notebook management.
 * This service handles data operations without DOM manipulation.
 * TSX components should use this service and handle rendering themselves.
 */

import type { Source, Notebook } from '../../types/index'
import {
  getNotebooks,
  saveNotebook,
  createNotebook,
  deleteNotebook as dbDeleteNotebook,
  getNotebook,
  getActiveNotebookId,
  setActiveNotebookId,
  getSourcesByNotebook,
  deleteSource as dbDeleteSource,
  createSource,
  getSummary,
  saveSummary,
  createSummary,
} from '../../lib/storage'
import { generateSummaryInBackground } from '../../lib/transforms/summary'
import type { ExtractedLink } from '../../types/index'

// ============================================================================
// State
// ============================================================================

let currentNotebookId: string | null = null

// ============================================================================
// Notebook Operations
// ============================================================================

export async function getAllNotebooks(): Promise<Notebook[]> {
  return await getNotebooks()
}

export async function getNotebookById(id: string): Promise<Notebook | null> {
  return await getNotebook(id)
}

export function createNewNotebook(name: string): Notebook {
  return createNotebook(name)
}

export async function deleteNotebook(id: string): Promise<void> {
  await dbDeleteNotebook(id)
}

export async function updateNotebook(notebook: Notebook): Promise<void> {
  await saveNotebook(notebook)
}

export async function getCurrentNotebookIdState(): Promise<string | null> {
  if (currentNotebookId === null) {
    currentNotebookId = await getActiveNotebookId()
  }
  return currentNotebookId
}

export async function setCurrentNotebook(id: string | null): Promise<void> {
  currentNotebookId = id
  if (id !== null) {
    await setActiveNotebookId(id)
  }
}

export async function switchNotebook(notebookId: string): Promise<void> {
  await setCurrentNotebook(notebookId)
}

// ============================================================================
// Sources
// ============================================================================

export async function getSources(notebookId: string): Promise<Source[]> {
  return await getSourcesByNotebook(notebookId)
}

export async function getCurrentNotebookSources(): Promise<Source[]> {
  const id = await getCurrentNotebookIdState()
  if (!id) return []
  return await getSourcesByNotebook(id)
}

export function addSourceToNotebook(
  notebookId: string,
  type: Source['type'],
  url: string,
  title: string,
  content: string,
  links?: ExtractedLink[],
): Source {
  return createSource(notebookId, type, url, title, content, links)
}

export async function removeSource(sourceId: string): Promise<void> {
  await dbDeleteSource(sourceId)
}

// ============================================================================
// Summary
// ============================================================================

export async function getNotebookSummary(notebookId: string): Promise<string | null> {
  const summary = await getSummary(notebookId)
  return summary?.content || null
}

export async function saveNotebookSummary(notebookId: string, content: string, sourceIds: string[] = []): Promise<void> {
  const existing = await getSummary(notebookId)
  if (existing) {
    existing.content = content
    existing.sourceIds = sourceIds
    await saveSummary(existing)
  }
  else {
    const summary = createSummary(notebookId, sourceIds, content)
    await saveSummary(summary)
  }
}

// Re-export background summary generation from transforms
export { generateSummaryInBackground }

// ============================================================================
// Helper functions for UI
// ============================================================================

/**
 * Gets options for the notebook select dropdown
 */
export async function getNotebookOptions(): Promise<Array<{ value: string, label: string }>> {
  const notebooks = await getAllNotebooks()
  return notebooks.map(nb => ({ value: nb.id, label: nb.name }))
}

/**
 * Creates a new notebook with the given name and sets it as current
 */
export async function createAndSelectNotebook(name: string): Promise<Notebook> {
  const notebook = createNewNotebook(name)
  await setCurrentNotebook(notebook.id)
  return notebook
}
