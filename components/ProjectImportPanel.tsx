/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectImportPanel.tsx - Text import panel for script projects.
 *
 * Accepts pasted or uploaded Markdown/plain text and submits it to the project
 * import workflow, where headings become sections and paragraphs become segments.
 */

import React from 'react';
import { FileText, Loader2, Upload, X } from 'lucide-react';

interface ProjectImportPanelProps {
  importText: string;
  importing: boolean;
  onChangeText: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

/** Render the import controls for adding bulk script text to a project. */
const ProjectImportPanel: React.FC<ProjectImportPanelProps> = ({
  importText,
  importing,
  onChangeText,
  onSubmit,
  onFileImport,
  onClose,
}) => (
  <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
    <div className="flex items-center justify-between gap-2">
      <div>
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Import from text</p>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
          Paste Markdown or plain text. Lines starting with{' '}
          <code className="rounded bg-zinc-200 dark:bg-zinc-800 px-1 text-[11px]">#</code>{' '}
          become sections; paragraphs become segments.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
      >
        <X size={14} />
      </button>
    </div>

    <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 transition-colors">
      <FileText size={13} />
      Load from file (.txt / .md)
      <input
        type="file"
        accept=".txt,.md,.markdown"
        className="sr-only"
        onChange={onFileImport}
      />
    </label>

    <form onSubmit={onSubmit} className="space-y-2">
      <textarea
        rows={10}
        value={importText}
        onChange={e => onChangeText(e.target.value)}
        placeholder={"# Chapter One\n\nThe story begins here...\n\n# Chapter Two\n\nThe adventure continues..."}
        className="w-full resize-y rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
      />
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={importing || !importText.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-4 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
        >
          {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          Import
        </button>
      </div>
    </form>
  </div>
);

export default ProjectImportPanel;
