/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectListPanel.tsx - Sidebar panel with project views, search, sort,
 * creation, and per-project context menus. State is owned by ProjectWorkspace;
 * this component owns only local list presentation state.
 */

import React, { useMemo, useState } from 'react';
import { ChevronRight, Loader2, Plus } from 'lucide-react';
import { Client, ProjectKind, ProjectSummary, ScriptProject } from '../../types';
import ProjectListRow from './ProjectListRow';
import ProjectListToolbar from './ProjectListToolbar';
import {
  ProjectSort,
  ProjectView,
  projectMatchesSearch,
  projectMatchesView,
  sortProjects,
} from './projectListFilters';

export type { ProjectSort } from './projectListFilters';

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
  newProjectOpen: boolean;
  onNewTitleChange: (v: string) => void;
  onNewKindChange: (v: ProjectKind) => void;
  onNewDescriptionChange: (v: string) => void;
  onNewClientIdChange: (v: number | null) => void;
  onNewTemplateIdChange: (v: string) => void;
  onCreateProject: (e: React.FormEvent) => void;
  onOpenNewProject: () => void;
  onCloseNewProject: () => void;
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
  newProjectOpen,
  onNewTitleChange,
  onNewKindChange: _onNewKindChange,
  onNewDescriptionChange: _onNewDescriptionChange,
  onNewClientIdChange: _onNewClientIdChange,
  onNewTemplateIdChange: _onNewTemplateIdChange,
  onCreateProject: _onCreateProject,
  onOpenNewProject,
  onCloseNewProject,
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
  const [projectSearch, setProjectSearch] = useState('');
  const [projectSort, setProjectSort] = useState<ProjectSort>('updated_desc');
  const [projectView, setProjectView] = useState<ProjectView>('active');

  const clientById = useMemo(() => new Map(clients.map(client => [client.id, client])), [clients]);

  const visibleProjects = useMemo(() => {
    const filtered = projects.filter(project => {
      const client = project.client_id ? clientById.get(project.client_id) : undefined;
      return (
        projectMatchesView(project, projectView, projectSummaries[project.id]) &&
        projectMatchesSearch(project, projectSearch, client)
      );
    });
    return sortProjects(filtered, projectView === 'recent' ? 'updated_desc' : projectSort);
  }, [projects, projectView, projectSearch, projectSort, projectSummaries, clientById]);

  const archivedProjects = useMemo(
    () => sortProjects(projects.filter(project => project.status === 'archived'), projectSort),
    [projects, projectSort],
  );

  const selectedProject = selectedProjectId !== null
    ? projects.find(project => project.id === selectedProjectId)
    : null;
  const selectedProjectVisible = selectedProject
    ? visibleProjects.some(project => project.id === selectedProject.id)
    : true;
  const showHiddenActiveProject = !!selectedProject && !selectedProjectVisible && (projectSearch.trim() || projectView !== 'active');

  const renderProjectRow = (project: ScriptProject) => (
    <ProjectListRow
      key={project.id}
      project={project}
      active={project.id === selectedProjectId}
      client={project.client_id ? clientById.get(project.client_id) : null}
      summary={projectSummaries[project.id]}
      fallbackSegmentCount={segmentCounts[project.id] ?? null}
      contextMenuOpen={contextMenuProjectId === project.id}
      renaming={renamingProjectId === project.id}
      renameValue={renameValue}
      savingRename={savingRename}
      onSelect={() => {
        onSetContextMenu(null);
        onSelectProject(project.id);
      }}
      onSetContextMenu={open => onSetContextMenu(open ? project.id : null)}
      onStartRename={() => {
        onSetContextMenu(null);
        onStartRename(project);
      }}
      onRenameValueChange={onRenameValueChange}
      onSaveRename={() => onSaveRename(project)}
      onCancelRename={onCancelRename}
      onArchive={() => {
        onSetContextMenu(null);
        onArchive(project);
      }}
      onUnarchive={() => {
        onSetContextMenu(null);
        onUnarchive(project);
      }}
    />
  );

  return (
    <div data-testid="project-list" className="flex min-h-0 flex-1 flex-col">
      <ProjectListToolbar
        search={projectSearch}
        sort={projectSort}
        view={projectView}
        newProjectOpen={newProjectOpen}
        onSearchChange={setProjectSearch}
        onSortChange={setProjectSort}
        onViewChange={setProjectView}
        onNewProject={() => {
          if (newProjectOpen) {
            onCloseNewProject();
          } else {
            onNewTitleChange('');
            onOpenNewProject();
          }
        }}
      />

      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-2">
        {loadingProjects ? (
          <div className="flex items-center justify-center py-10 text-zinc-400">
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">No projects yet.</p>
            <button
              type="button"
              onClick={onOpenNewProject}
              className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--accent-600)] hover:underline dark:text-[var(--accent-400)]"
            >
              <Plus size={12} /> Create your first project
            </button>
          </div>
        ) : (
          <>
            {showHiddenActiveProject && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="font-semibold">Current project is hidden by filters.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setProjectSearch('');
                      setProjectView('active');
                    }}
                    className="rounded-md bg-white px-2 py-1 font-semibold text-amber-800 shadow-sm dark:bg-zinc-900 dark:text-amber-200"
                  >
                    Clear filters
                  </button>
                  <button
                    type="button"
                    onClick={() => selectedProject && onSelectProject(selectedProject.id)}
                    className="rounded-md px-2 py-1 font-semibold text-amber-700 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
                  >
                    Keep browsing
                  </button>
                </div>
              </div>
            )}

            {visibleProjects.length === 0 ? (
              <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                No projects match the current filters.
              </p>
            ) : (
              visibleProjects.map(renderProjectRow)
            )}

            {projectView !== 'archived' && archivedProjects.length > 0 && (
              <div className="pt-1">
                <button
                  onClick={() => onSetShowArchived(prev => !prev)}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-50 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                >
                  <ChevronRight
                    size={12}
                    className={`transition-transform ${showArchived ? 'rotate-90' : ''}`}
                  />
                  {showArchived ? 'Hide archived' : `Show archived (${archivedProjects.length})`}
                </button>
                {showArchived && archivedProjects.map(renderProjectRow)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ProjectListPanel;
