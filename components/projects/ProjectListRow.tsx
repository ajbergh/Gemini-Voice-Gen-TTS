/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Archive, ArchiveRestore, MoreHorizontal, Pencil } from 'lucide-react';
import { Client, ProjectSummary, ScriptProject } from '../../types';
import ProjectProgressMeter from './ProjectProgressMeter';
import { formatKind, formatUpdatedAt } from './projectListFilters';

interface ProjectListRowProps {
  project: ScriptProject;
  active: boolean;
  client?: Client | null;
  summary?: ProjectSummary;
  fallbackSegmentCount?: number | null;
  contextMenuOpen: boolean;
  renaming: boolean;
  renameValue: string;
  savingRename: boolean;
  onSelect: () => void;
  onSetContextMenu: (open: boolean) => void;
  onStartRename: () => void;
  onRenameValueChange: (value: string) => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}

const ProjectListRow: React.FC<ProjectListRowProps> = ({
  project,
  active,
  client,
  summary,
  fallbackSegmentCount = null,
  contextMenuOpen,
  renaming,
  renameValue,
  savingRename,
  onSelect,
  onSetContextMenu,
  onStartRename,
  onRenameValueChange,
  onSaveRename,
  onCancelRename,
  onArchive,
  onUnarchive,
}) => {
  const segmentCount = summary?.segment_count ?? fallbackSegmentCount ?? 0;
  const renderedCount = summary?.rendered_count ?? 0;
  const approvedCount = summary?.approved_count ?? 0;
  const openQcCount = summary?.open_qc_count ?? 0;
  const updatedAt = formatUpdatedAt(project.updated_at);
  const archived = project.status === 'archived';

  return (
    <div className="relative group">
      <div
        className={`rounded-lg border transition-colors ${
          active
            ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900'
            : 'border-zinc-200 bg-white hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:bg-zinc-900'
        } ${archived ? 'opacity-65 hover:opacity-100' : ''}`}
      >
        {renaming ? (
          <form
            onSubmit={event => {
              event.preventDefault();
              onSaveRename();
            }}
            className="p-3"
          >
            <input
              autoFocus
              value={renameValue}
              onChange={event => onRenameValueChange(event.target.value)}
              onKeyDown={event => { if (event.key === 'Escape') onCancelRename(); }}
              className="w-full rounded border border-[var(--accent-400)] bg-white px-2 py-0.5 text-sm font-semibold text-zinc-900 focus:outline-none focus:ring-1 focus:ring-[var(--accent-400)] dark:bg-zinc-900 dark:text-white"
              disabled={savingRename}
            />
            <p className="mt-1 text-[10px] text-zinc-400">Enter to save - Esc to cancel</p>
          </form>
        ) : (
          <div className="flex items-start gap-1">
            <button
              onClick={onSelect}
              className="min-w-0 flex-1 p-3 text-left"
              aria-current={active ? 'page' : undefined}
            >
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-white">
                    {project.title}
                  </p>
                  {updatedAt && (
                    <span className="shrink-0 text-[10px] font-medium text-zinc-400">
                      {updatedAt}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                    {formatKind(project.kind)}
                  </span>
                  {segmentCount > 0 && (
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      {segmentCount} seg
                    </span>
                  )}
                  {segmentCount > 0 && (
                    <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">
                      {renderedCount}/{segmentCount} rendered
                    </span>
                  )}
                  {openQcCount > 0 && (
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                      {openQcCount} QC
                    </span>
                  )}
                  {archived && (
                    <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                      archived
                    </span>
                  )}
                </div>
                {client && (
                  <p className="mt-1 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {client.name}
                  </p>
                )}
                {segmentCount > 0 && (
                  <div className="mt-2">
                    <ProjectProgressMeter
                      total={segmentCount}
                      rendered={renderedCount}
                      approved={approvedCount}
                      openQcCount={openQcCount}
                    />
                  </div>
                )}
              </div>
            </button>
            <button
              aria-label="Project options"
              onClick={event => {
                event.stopPropagation();
                onSetContextMenu(!contextMenuOpen);
              }}
              className={`mt-2 mr-1.5 shrink-0 rounded p-1 transition-colors ${
                contextMenuOpen
                  ? 'bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white'
                  : 'text-zinc-400 opacity-0 hover:text-zinc-700 focus:opacity-100 group-hover:opacity-100 dark:hover:text-zinc-200'
              }`}
            >
              <MoreHorizontal size={14} />
            </button>
          </div>
        )}
      </div>

      {contextMenuOpen && (
        <div
          className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-900"
          role="menu"
        >
          {archived ? (
            <button
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
              onClick={onUnarchive}
            >
              <ArchiveRestore size={14} />
              Unarchive
            </button>
          ) : (
            <>
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800"
                onClick={onStartRename}
              >
                <Pencil size={14} />
                Rename
              </button>
              <button
                role="menuitem"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-600 hover:bg-zinc-50 dark:text-amber-400 dark:hover:bg-zinc-800"
                onClick={onArchive}
              >
                <Archive size={14} />
                Archive
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectListRow;
