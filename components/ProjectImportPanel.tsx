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

import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Eye, FileText, Loader2, Upload, X } from 'lucide-react';
import { ImportPreview } from '../types';

interface ProjectImportPanelProps {
  importText: string;
  importing: boolean;
  previewing: boolean;
  preview: ImportPreview | null;
  previewStale: boolean;
  previewError: string | null;
  mobile?: boolean;
  onChangeText: (v: string) => void;
  onPreview: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onFileImport: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClose: () => void;
}

/** Render the import controls for adding bulk script text to a project. */
const ProjectImportPanel: React.FC<ProjectImportPanelProps> = ({
  importText,
  importing,
  previewing,
  preview,
  previewStale,
  previewError,
  mobile = false,
  onChangeText,
  onPreview,
  onSubmit,
  onFileImport,
  onClose,
}) => {
  const canImport = !!preview && !previewStale && !previewError;
  const previewSections = preview?.sections ?? [];
  const unsectioned = preview?.unsectioned_segments ?? [];
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mobile) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    dialogRef.current?.focus({ preventScroll: true });
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobile, onClose]);

  return (
  <div
    ref={dialogRef}
    tabIndex={mobile ? -1 : undefined}
    className={
      mobile
        ? 'fixed inset-0 z-[70] flex flex-col bg-white dark:bg-zinc-950'
        : 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3'
    }
    role={mobile ? 'dialog' : undefined}
    aria-modal={mobile ? true : undefined}
    aria-label={mobile ? 'Import script text' : undefined}
  >
    <div className={mobile ? 'flex shrink-0 items-center justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3' : 'flex items-center justify-between gap-2'}>
      <div>
        <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Import from text</p>
        <p className={`${mobile ? 'max-w-[18rem]' : ''} mt-0.5 text-xs text-zinc-500 dark:text-zinc-400`}>
          Paste Markdown or plain text. Lines starting with{' '}
          <code className="rounded bg-zinc-200 dark:bg-zinc-800 px-1 text-[11px]">#</code>{' '}
          become sections; paragraphs become segments.
        </p>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close import sheet"
        className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
      >
        <X size={14} />
      </button>
    </div>

    <div className={mobile ? 'min-h-0 flex-1 overflow-y-auto px-4 py-3' : 'space-y-3'}>
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

    <form onSubmit={onSubmit} className={mobile ? 'mt-3 flex min-h-[calc(100%-3rem)] flex-col gap-3' : 'space-y-2'}>
      <textarea
        rows={mobile ? 12 : 10}
        value={importText}
        onChange={e => onChangeText(e.target.value)}
        placeholder={"# Chapter One\n\nThe story begins here...\n\n# Chapter Two\n\nThe adventure continues..."}
        className={`w-full resize-y rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)] ${mobile ? 'min-h-[15rem] shrink-0' : ''}`}
      />

      {(preview || previewError) && (
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2">
          {previewError ? (
            <p className="flex items-center gap-2 text-xs font-medium text-red-600 dark:text-red-400">
              <AlertTriangle size={13} />
              {previewError}
            </p>
          ) : preview ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">
                  {preview.section_count} section{preview.section_count === 1 ? '' : 's'}, {preview.segment_count} segment{preview.segment_count === 1 ? '' : 's'}
                </p>
                {previewStale && (
                  <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                    Preview outdated
                  </span>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {unsectioned.length > 0 && (
                  <div className="rounded-md bg-zinc-50 dark:bg-zinc-900 px-2 py-1.5">
                    <p className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Unsectioned - {unsectioned.length} seg</p>
                  </div>
                )}
                {previewSections.map((section, index) => (
                  <div key={`${section.title}-${index}`} className="rounded-md bg-zinc-50 dark:bg-zinc-900 px-2 py-1.5">
                    <p className="truncate text-[11px] font-semibold text-zinc-600 dark:text-zinc-300">
                      {section.title}
                      <span className="ml-1 font-normal text-zinc-400 dark:text-zinc-500">
                        {section.segments.length} seg
                      </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      <div className={mobile ? 'sticky bottom-0 -mx-4 mt-auto flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 px-4 py-3 backdrop-blur' : 'flex justify-end gap-2'}>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onPreview}
          disabled={previewing || !importText.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors disabled:opacity-50"
        >
          {previewing ? <Loader2 size={13} className="animate-spin" /> : <Eye size={13} />}
          Preview
        </button>
        <button
          type="submit"
          disabled={importing || !importText.trim() || !canImport}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-4 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
        >
          {importing ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          Import
        </button>
      </div>
    </form>
    </div>
  </div>
  );
};

export default ProjectImportPanel;
