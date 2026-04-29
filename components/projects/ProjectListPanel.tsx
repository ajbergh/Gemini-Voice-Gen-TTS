/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectListPanel.tsx — Sidebar panel with project search, sort, new-project
 * sheet, and per-project context menu. State is owned by ProjectWorkspace;
 * this component is purely presentational.
 */

import React, { useMemo, useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Client, ProjectKind, ProjectSummary, ScriptProject } from '../../types';
import NewProjectSheet from './NewProjectSheet';
import { getProjectTemplate } from './projectTemplates';

export type ProjectSort = 'updated_desc' | 'created_desc' | 'title_asc' | 'kind_asc';

const PROJECT_KINDS: { value: ProjectKind; label: string }[] = [
  { value: 'audiobook', label: 'Audiobook' },
  { value: 'voiceover', label: 'Voiceover' },
  { value: 'podcast', label: 'Podcast' },
  { value: 'training', label: 'Training' },
  { value: 'character_reel', label: 'Character Reel' },
  { value: 'other', label: 'Other' },
];

const SORT_OPTIONS: { value: ProjectSort; label: string }[] = [
  { value: 'updated_desc', label: 'Recently updated' },
  { value: 'created_desc', label: 'Recently created' },
  { value: 'title_asc', label: 'Title A–Z' },
  { value: 'kind_asc', label: 'Kind' },
];

function formatKind(kind: string): string {
  return PROJECT_KINDS.find(k => k.value === kind)?.label ?? kind.replace(/_/g, ' ');
}

export interface ProjectListPanelProps {
  projects: ScriptProject[];
  selectedProjectId: number | null;
  clients: Client[];
  projectSummaries: Record<number, ProjectSummary>;
  segmentCounts: Record<number, number>;
  loadingProjects: boolean;
  creating: boolean;
  newTitle: string;
  newKind: ProjectKind;
  newDescription: string;
  newClientId: number | null;
  newTemplateId: string;
  showArchived: boolean;
  contextMenuProjectId: number | null;
  renamingProjectId: number | null;
  renameValue: string;
  savingRename: boolean;
  onNewTitleChange: (v: string) => void;
  onNewKindChange: (v: ProjectKind) => void;
  onNewDescriptionChange: (v: string) => void;
  onNewClientIdChange: (v: number | null) => void;
  onNewTemplateIdChange: (v: string) => void;
  onCreateProject: (e: React.FormEvent) => void;
  onSelectProject: (id: number) => void;
  onArchive: (project: ScriptProject) => void;
  onUnarchive: (project: ScriptProject) => void;
  onStartRename: (project: ScriptProject) => void;
  onRenameValueChange: (v: string) => void;
  onSaveRename: (project: ScriptProject) => void;
  onCancelRename: () => void;
  onSetContextMenu: (id: number | null) => void;
  onSetShowArchived: (v: boolean | ((prev: boolean) => boolean)) => void;
}

const ProjectListPanel: React.FC<ProjectListPanelProps> = ({
  projects,
  selectedProjectId,
  clients,
  projectSummaries,
  segmentCounts,
  loadingProjects,
  creating,
  newTitle,
  newKind,
  newDescription,
  newClientId,
  newTemplateId,
  showArchived,
  contextMenuProjectId,
  renamingProjectId,
  renameValue,
  savingRename,
  onNewTitleChange,
  onNewKindChange,
  onNewDescriptionChange,
  onNewClientIdChange,
  onNewTemplateIdChange,
  onCreateProject,
  onSelectProject,
  onArchive,
  onUnarchive,
  onStartRename,
  onRenameValueChange,
  onSaveRename,
  onCancelRename,
  onSetContextMenu,
  onSetShowArchived,
}) => {
  const [showNewProject, setShowNewProject] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectSort, setProjectSort] = useState<ProjectSort>('updated_desc');

  const clientById = useMemo(() => new Map(clients.map(client => [client.id, client])), [clients]);

  const activeProjects = useMemo(() => {
    let list = projects.filter(p => p.status !== 'archived');
    const q = projectSearch.trim().toLowerCase();
    if (q) {
      list = list.filter(p => {
        const clientName = p.client_id ? clientById.get(p.client_id)?.name ?? '' : '';
        return (
          p.title.toLowerCase().includes(q) ||
          p.kind.toLowerCase().includes(q) ||
          ((p.description ?? '').toLowerCase()).includes(q) ||
          clientName.toLowerCase().includes(q)
        );
      });
    }
    const sorted = [...list];
    switch (projectSort) {
      case 'updated_desc':
        sorted.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
        break;
      case 'created_desc':
        sorted.sort((a, b) => b.created_at.localeCompare(a.created_at));
        break;
      case 'title_asc':
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'kind_asc':
        sorted.sort((a, b) => a.kind.localeCompare(b.kind) || a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  }, [projects, projectSearch, projectSort, clientById]);

  const archivedProjects = useMemo(
    () => projects.filter(p => p.status === 'archived'),
    [projects],
  );

  const handleCreateAndClose = (e: React.FormEvent) => {
    onCreateProject(e);
    setShowNewProject(false);
  };

  const handleTemplateChange = (templateId: string) => {
    const template = getProjectTemplate(templateId);
    onNewTemplateIdChange(templateId);
    onNewKindChange(template.kind);
    onNewDescriptionChange(template.description);
  };

  return (
    <div data-testid="project-list" className="flex flex-col min-h-0 flex-1">
      {/* Search row + New Project toggle */}
      <div className="shrink-0 border-b border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
        <div className="flex items-center gap-1.5">
          <div className="relative flex-1 min-w-0">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label="Search projects"
              value={projectSearch}
              onChange={e => setProjectSearch(e.target.value)}
              placeholder="Search projects…"
              className="h-8 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 pl-7 pr-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setShowNewProject(prev => !prev);
              if (!showNewProject) onNewTitleChange('');
            }}
            aria-expanded={showNewProject}
            aria-label={showNewProject ? 'Cancel new project' : 'New project'}
            title={showNewProject ? 'Cancel' : 'New project'}
            className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
              showNewProject
                ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900 text-[var(--accent-600)]'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900'
            }`}
          >
            {showNewProject ? <X size={14} /> : <Plus size={14} />}
          </button>
        </div>

        {/* Sort selector */}
        <select
          aria-label="Sort projects"
          value={projectSort}
          onChange={e => setProjectSort(e.target.value as ProjectSort)}
          className="h-7 w-full rounded-md border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-[11px] text-zinc-600 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-[var(--accent-100)]"
        >
          {SORT_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>

        {/* Collapsible new-project form */}
        {showNewProject && (
          <NewProjectSheet
            title={newTitle}
            kind={newKind}
            description={newDescription}
            clientId={newClientId}
            templateId={newTemplateId}
            clients={clients}
            creating={creating}
            onTitleChange={onNewTitleChange}
            onKindChange={onNewKindChange}
            onDescriptionChange={onNewDescriptionChange}
            onClientIdChange={onNewClientIdChange}
            onTemplateIdChange={handleTemplateChange}
            onSubmit={handleCreateAndClose}
          />
        )}
      </div>

      {/* Project list */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-1">
        {loadingProjects ? (
          <div className="flex items-center justify-center py-10 text-zinc-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No projects yet.</p>
            <button
              type="button"
              onClick={() => setShowNewProject(true)}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-600)] dark:text-[var(--accent-400)] hover:underline"
            >
              <Plus size={12} /> Create your first project
            </button>
          </div>
        ) : activeProjects.length === 0 && projectSearch ? (
          <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No projects match &ldquo;{projectSearch}&rdquo;.
          </p>
        ) : (
          <>
            {activeProjects.map(project => {
              const active = project.id === selectedProjectId;
              const isRenaming = renamingProjectId === project.id;
              const hasMenu = contextMenuProjectId === project.id;
              const summary = projectSummaries[project.id];
              const segCount = summary?.segment_count ?? segmentCounts[project.id] ?? null;
              const clientName = project.client_id ? clientById.get(project.client_id)?.name : null;

              return (
                <div key={project.id} className="relative group">
                  <div
                    className={`rounded-lg border transition-colors ${
                      active
                        ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900'
                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                    }`}
                  >
                    {isRenaming ? (
                      <form
                        onSubmit={e => { e.preventDefault(); onSaveRename(project); }}
                        className="p-3"
                      >
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={e => onRenameValueChange(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Escape') onCancelRename(); }}
                          className="w-full rounded border border-[var(--accent-400)] bg-white dark:bg-zinc-900 px-2 py-0.5 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[var(--accent-400)]"
                          disabled={savingRename}
                        />
                        <p className="mt-1 text-[10px] text-zinc-400">Enter to save · Esc to cancel</p>
                      </form>
                    ) : (
                      <div className="flex items-start gap-1">
                        <button
                          onClick={() => { onSetContextMenu(null); onSelectProject(project.id); }}
                          className="min-w-0 flex-1 p-3 text-left"
                          aria-current={active ? 'page' : undefined}
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                              {project.title}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                                {formatKind(project.kind)}
                              </span>
                              {segCount !== null && segCount > 0 && (
                                <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                  {segCount} seg
                                </span>
                              )}
                              {clientName && (
                                <span className="truncate text-xs text-zinc-400 dark:text-zinc-500">
                                  {clientName}
                                </span>
                              )}
                              {summary && summary.open_qc_count > 0 && (
                                <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                                  {summary.open_qc_count} QC
                                </span>
                              )}
                            </div>
                          </div>
                        </button>
                        <button
                          aria-label="Project options"
                          onClick={e => {
                            e.stopPropagation();
                            onSetContextMenu(hasMenu ? null : project.id);
                          }}
                          className={`mt-2 mr-1.5 shrink-0 rounded p-1 transition-colors ${
                            hasMenu
                              ? 'text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800'
                              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 focus:opacity-100'
                          }`}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {hasMenu && (
                    <div
                      className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl py-1"
                      role="menu"
                    >
                      <button
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        onClick={() => { onSetContextMenu(null); onStartRename(project); }}
                      >
                        <Pencil size={14} />
                        Rename
                      </button>
                      <button
                        role="menuitem"
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-amber-600 dark:text-amber-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        onClick={() => { onSetContextMenu(null); onArchive(project); }}
                      >
                        <Archive size={14} />
                        Archive
                      </button>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Archived section */}
            {archivedProjects.length > 0 && (
              <div className="pt-2">
                <button
                  onClick={() => onSetShowArchived(prev => !prev)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}
                  />
                  {showArchived ? 'Hide archived' : `Show archived (${archivedProjects.length})`}
                </button>

                {showArchived && archivedProjects.map(project => {
                  const active = project.id === selectedProjectId;
                  const hasMenu = contextMenuProjectId === project.id;
                  return (
                    <div key={project.id} className="relative group mt-1">
                      <div
                        className={`flex items-start gap-1 w-full rounded-lg border transition-colors opacity-60 hover:opacity-100 ${
                          active
                            ? 'border-[var(--accent-400)] bg-[var(--accent-50)] dark:border-[var(--accent-600)] dark:bg-zinc-900'
                            : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900'
                        }`}
                      >
                        <button
                          onClick={() => { onSetContextMenu(null); onSelectProject(project.id); }}
                          className="min-w-0 flex-1 p-3 text-left"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                              {project.title}
                            </p>
                            <div className="mt-1 flex items-center gap-2">
                              <span className="text-xs capitalize text-zinc-500 dark:text-zinc-400">
                                {formatKind(project.kind)}
                              </span>
                              <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:text-zinc-400">
                                archived
                              </span>
                            </div>
                          </div>
                        </button>
                        <button
                          aria-label="Project options"
                          onClick={e => {
                            e.stopPropagation();
                            onSetContextMenu(hasMenu ? null : project.id);
                          }}
                          className={`mt-2 mr-1.5 shrink-0 rounded p-1 transition-colors ${
                            hasMenu
                              ? 'text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-800'
                              : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 opacity-0 group-hover:opacity-100 focus:opacity-100'
                          }`}
                        >
                          <MoreHorizontal size={14} />
                        </button>
                      </div>

                      {hasMenu && (
                        <div
                          className="absolute right-0 top-full z-40 mt-1 min-w-[160px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl py-1"
                          role="menu"
                        >
                          <button
                            role="menuitem"
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                            onClick={() => { onSetContextMenu(null); onUnarchive(project); }}
                          >
                            <ArchiveRestore size={14} />
                            Unarchive
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectListPanel;
