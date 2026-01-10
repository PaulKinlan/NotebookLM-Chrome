/**
 * Export functionality for notebooks and sources
 * Supports Markdown and JSON formats
 */

import type { Notebook, Source, ChatMessage, Transformation } from '../types/index.ts';

export type ExportFormat = 'markdown' | 'json';

export interface NotebookExport {
  notebook: Notebook;
  sources: Source[];
  chatHistory: ChatMessage[];
  transformations: Transformation[];
  exportedAt: string;
  version: string;
}

/**
 * Export a notebook and its contents to JSON format
 */
export function exportToJSON(data: NotebookExport): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Export a notebook and its contents to Markdown format
 */
export function exportToMarkdown(data: NotebookExport): string {
  const lines: string[] = [];
  const { notebook, sources, chatHistory, transformations } = data;

  // Header
  lines.push(`# ${notebook.name}`);
  lines.push('');
  lines.push(`*Exported from FolioLM on ${new Date(data.exportedAt).toLocaleDateString()}*`);
  lines.push('');

  // Sources section
  if (sources.length > 0) {
    lines.push('## Sources');
    lines.push('');

    for (const source of sources) {
      lines.push(`### ${source.title}`);
      lines.push('');
      lines.push(`- **URL:** ${source.url}`);
      lines.push(`- **Type:** ${source.type}`);
      if (source.metadata?.wordCount) {
        lines.push(`- **Word Count:** ${source.metadata.wordCount}`);
      }
      lines.push('');

      // Include content (truncated for very long content)
      if (source.content) {
        const content = source.content.length > 5000
          ? source.content.substring(0, 5000) + '\n\n*[Content truncated...]*'
          : source.content;
        lines.push('#### Content');
        lines.push('');
        lines.push(content);
        lines.push('');
      }

      lines.push('---');
      lines.push('');
    }
  }

  // Chat history section
  if (chatHistory.length > 0) {
    lines.push('## Chat History');
    lines.push('');

    for (const message of chatHistory) {
      const role = message.role === 'user' ? 'You' : 'Assistant';
      const time = new Date(message.timestamp).toLocaleString();

      lines.push(`**${role}** *(${time})*`);
      lines.push('');
      lines.push(message.content);
      lines.push('');

      // Include citations if present
      if (message.citations && message.citations.length > 0) {
        lines.push('*Citations:*');
        for (const citation of message.citations) {
          lines.push(`- ${citation.sourceTitle}: "${citation.excerpt}"`);
        }
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
  }

  // Transformations section
  if (transformations.length > 0) {
    lines.push('## Transformations');
    lines.push('');

    for (const transform of transformations) {
      lines.push(`### ${transform.title} (${transform.type})`);
      lines.push('');
      lines.push(transform.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Generate a filename for the export
 */
export function generateExportFilename(notebookName: string, format: ExportFormat): string {
  const sanitized = notebookName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  const date = new Date().toISOString().split('T')[0];
  const extension = format === 'json' ? 'json' : 'md';

  return `${sanitized}-${date}.${extension}`;
}

/**
 * Download content as a file
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL object
  URL.revokeObjectURL(url);
}

/**
 * Export notebook to file (convenience function)
 */
export function exportNotebook(
  data: NotebookExport,
  format: ExportFormat
): void {
  const filename = generateExportFilename(data.notebook.name, format);

  if (format === 'json') {
    const content = exportToJSON(data);
    downloadFile(content, filename, 'application/json');
  } else {
    const content = exportToMarkdown(data);
    downloadFile(content, filename, 'text/markdown');
  }
}

/**
 * Export all notebooks (for backup purposes)
 */
export interface FullBackup {
  notebooks: NotebookExport[];
  exportedAt: string;
  version: string;
}

export function exportFullBackup(notebooks: NotebookExport[]): string {
  const backup: FullBackup = {
    notebooks,
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
  };
  return JSON.stringify(backup, null, 2);
}

export function downloadFullBackup(notebooks: NotebookExport[]): void {
  const content = exportFullBackup(notebooks);
  const date = new Date().toISOString().split('T')[0];
  const filename = `foliolm-backup-${date}.json`;
  downloadFile(content, filename, 'application/json');
}
