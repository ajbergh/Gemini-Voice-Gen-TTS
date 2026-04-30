/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectActionBar.tsx — Tab-aware action bar for the project workspace.
 *
 * Renders the primary actions for the active workspace tab plus an overflow
 * More menu with project-level secondary actions (Settings, Dictionaries,
 * Archive). State is owned by ProjectWorkspace; this component is presentational.
 *
 * Actions per tab (Phase 2 baseline):
 *   Script  — Prep, Import, Render all
 *   Cast    — (tab panel owns controls; More menu always visible)
 *   Review  — (tab panel owns transport; More menu always visible)
 *   Timeline — (tab panel owns stitch; More menu always visible)
 *   Export  — (tab panel owns export; More menu always visible)
 */

import React, { useState } from 'react';
import {
  Archive,
  BookOpen,
  HelpCircle,
  Loader2,
  MoreHorizontal,
  Play,
  Settings,
  Sparkles,
  Upload,
} from 'lucide-react';
import { ScriptProject } from '../../types';

export type WorkspaceTab = 'script' | 'cast' | 'review' | 'timeline' | 'export';

export interface ProjectActionBarProps {
  activeTab: WorkspaceTab;
  selectedProject: ScriptProject;
  archiving: boolean;
  batchRendering: boolean;
  showImport: boolean;
  showProjectSettings: boolean;
  showPronunciation: boolean;
  showOverflowMenu: boolean;
  mobile?: boolean;
  onPrep: () => void;
  onToggleImport: () => void;
  onRenderAll: () => void;
  onToggleSettings: () => void;
  onTogglePronunciation: () => void;
  onArchiveProject: () => void;
  onSetShowOverflowMenu: (v: boolean) => void;
}

const ProjectActionBar: React.FC<ProjectActionBarProps> = ({
  activeTab,
  selectedProject,
  archiving,
  batchRendering,
  showImport,
  showProjectSettings,
  showPronunciation,
  showOverflowMenu,
  mobile = false,
  onPrep,
  onToggleImport,
  onRenderAll,
  onToggleSettings,
  onTogglePronunciation,
  onArchiveProject,
  onSetShowOverflowMenu,
}) => {
  const [showStatusLegend, setShowStatusLegend] = useState(false);

  const scriptPrimaryActions = (
    <>
      {!mobile && (
        <button
          type="button"
          onClick={onPrep}
          title="AI script prep"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <Sparkles size={13} />
          <span className="hidden sm:inline">AI prep</span>
        </button>
      )}

      <button
        type="button"
        onClick={onToggleImport}
        data-tour-step="import"
        className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-colors ${mobile ? 'min-w-0 flex-1' : ''} ${
          showImport
            ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900 text-[var(--accent-700)] dark:text-[var(--accent-200)]'
            : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
        }`}
      >
        <Upload size={13} />
        <span className={mobile ? 'truncate' : 'hidden sm:inline'}>Import</span>
      </button>

      <button
        type="button"
        disabled={batchRendering}
        onClick={onRenderAll}
        data-tour-step="render-all"
        className={`inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-2.5 text-xs font-semibold text-white hover:bg-zinc-800 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50 ${mobile ? 'min-w-0 flex-1' : ''}`}
      >
        {batchRendering
          ? <Loader2 size={13} className="animate-spin" />
          : <Play size={13} />
        }
        <span className={mobile ? 'truncate' : 'hidden sm:inline'}>Render all</span>
      </button>

      <div className={mobile ? 'relative shrink-0' : 'relative'}>
        <button
          type="button"
          data-testid="status-legend-toggle"
          aria-label="Status legend"
          aria-expanded={showStatusLegend}
          onClick={() => setShowStatusLegend(prev => !prev)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          title="Status legend"
        >
          <HelpCircle size={14} />
        </button>
        {showStatusLegend && (
          <div className="absolute right-0 top-full z-30 mt-1 w-64 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 text-left shadow-lg">
            <p className="mb-2 text-xs font-semibold text-zinc-700 dark:text-zinc-200">Segment status legend</p>
            <div className="space-y-1.5">
              {[
                ['Draft', 'Not rendered yet.', 'bg-zinc-300 dark:bg-zinc-600'],
                ['Rendering', 'Audio generation is in progress.', 'bg-purple-400'],
                ['Rendered', 'Audio exists and is ready to review.', 'bg-teal-400'],
                ['Approved', 'Take is accepted for export.', 'bg-emerald-500'],
                ['Flagged', 'Needs attention before export.', 'bg-red-500'],
                ['Changed', 'Script changed after rendering.', 'bg-amber-400'],
              ].map(([label, description, swatch]) => (
                <div key={label} className="flex items-start gap-2">
                  <span className={`mt-1 h-2.5 w-2.5 rounded-full ${swatch}`} />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold text-zinc-700 dark:text-zinc-200">{label}</span>
                    <span className="block text-[11px] leading-snug text-zinc-500 dark:text-zinc-400">{description}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  );

  const overflowItems = (
    <>
      {mobile && activeTab === 'script' && (
        <button
          type="button"
          onClick={() => {
            onSetShowOverflowMenu(false);
            onPrep();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <Sparkles size={13} />
          AI Script Prep
        </button>
      )}
      <button
        type="button"
        onClick={onToggleSettings}
        className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
          showProjectSettings
            ? 'text-[var(--accent-700)] dark:text-[var(--accent-300)] bg-[var(--accent-50)] dark:bg-zinc-900'
            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
        }`}
      >
        <Settings size={13} />
        Project Settings
      </button>
      <button
        type="button"
        onClick={onTogglePronunciation}
        className={`flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold transition-colors ${
          showPronunciation
            ? 'text-[var(--accent-700)] dark:text-[var(--accent-300)] bg-[var(--accent-50)] dark:bg-zinc-900'
            : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
        }`}
      >
        <BookOpen size={13} />
        Dictionaries
      </button>
      <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
      <button
        type="button"
        onClick={onArchiveProject}
        disabled={archiving || selectedProject.status === 'archived'}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors disabled:opacity-40"
      >
        {archiving
          ? <Loader2 size={13} className="animate-spin" />
          : <Archive size={13} />
        }
        Archive Project
      </button>
    </>
  );

  return (
    <div
      className={
        mobile
          ? 'fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 flex items-center justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur'
          : 'flex items-center gap-1.5 pb-1'
      }
      data-testid={mobile ? 'mobile-project-action-bar' : undefined}
    >
      {/* Script tab primary actions */}
      {activeTab === 'script' && (
        scriptPrimaryActions
      )}

      {/* More overflow menu — shown on all tabs */}
      <div className={mobile ? 'relative shrink-0' : 'relative'}>
        <button
          type="button"
          aria-label="More actions"
          aria-expanded={showOverflowMenu}
          onClick={() => onSetShowOverflowMenu(!showOverflowMenu)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
        >
          <MoreHorizontal size={15} />
        </button>

        {showOverflowMenu && (
          mobile ? (
            <>
              <div
                className="fixed inset-0 z-[70] bg-black/20 dark:bg-black/40"
                aria-hidden="true"
                onClick={() => onSetShowOverflowMenu(false)}
              />
              <div
                role="menu"
                className="fixed inset-x-3 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] z-[80] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 py-1 shadow-2xl"
              >
                {overflowItems}
              </div>
            </>
          ) : (
            <>
            <div
              className="fixed inset-0 z-10"
              aria-hidden="true"
              onClick={() => onSetShowOverflowMenu(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg py-1">
              {overflowItems}
            </div>
          </>
          )
        )}
      </div>
    </div>
  );
};

export default ProjectActionBar;
