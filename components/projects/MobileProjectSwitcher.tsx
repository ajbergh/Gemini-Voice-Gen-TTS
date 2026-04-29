/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MobileProjectSwitcher.tsx - Phone project picker trigger and sheet.
 *
 * Keeps the selected project visible without permanently spending viewport
 * height on the full project list.
 */

import React, { useEffect, useRef } from 'react';
import { ChevronDown, FolderOpen, X } from 'lucide-react';
import { Client, ScriptProject } from '../../types';

interface MobileProjectSwitcherProps {
  project: ScriptProject;
  client?: Client | null;
  kindLabel: string;
  stageSummary: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

const MobileProjectSwitcher: React.FC<MobileProjectSwitcherProps> = ({
  project,
  client,
  kindLabel,
  stageSummary,
  open,
  onOpenChange,
  children,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOpenChange(false);
    };
    document.addEventListener('keydown', onKeyDown);
    sheetRef.current?.focus();
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  return (
    <>
      <button
        type="button"
        data-testid="mobile-project-switcher-trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => onOpenChange(true)}
        className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-3 text-left shadow-sm"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-50)] dark:bg-zinc-900 text-[var(--accent-600)] dark:text-[var(--accent-300)]">
          <FolderOpen size={17} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-zinc-900 dark:text-white">
            {project.title}
          </span>
          <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <span className="shrink-0 capitalize">{kindLabel}</span>
            {client && (
              <>
                <span aria-hidden="true">/</span>
                <span className="truncate">{client.name}</span>
              </>
            )}
            <span aria-hidden="true">/</span>
            <span className="truncate">{stageSummary}</span>
          </span>
        </span>
        <ChevronDown size={16} className="shrink-0 text-zinc-400" aria-hidden="true" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[70] bg-black/35 dark:bg-black/55"
            aria-hidden="true"
            onClick={() => onOpenChange(false)}
          />
          <div
            ref={sheetRef}
            tabIndex={-1}
            role="dialog"
            aria-modal="true"
            aria-label="Switch project"
            data-testid="mobile-project-switcher-sheet"
            className="fixed inset-x-0 bottom-0 top-10 z-[80] flex flex-col rounded-t-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl focus:outline-none"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900 dark:text-white">Switch project</p>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{project.title}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                aria-label="Close project switcher"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              {children}
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default MobileProjectSwitcher;
