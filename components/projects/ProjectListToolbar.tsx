/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Search, X } from 'lucide-react';
import { PROJECT_VIEWS, ProjectSort, ProjectView, SORT_OPTIONS } from './projectListFilters';

interface ProjectListToolbarProps {
  search: string;
  sort: ProjectSort;
  view: ProjectView;
  newProjectOpen: boolean;
  onSearchChange: (value: string) => void;
  onSortChange: (value: ProjectSort) => void;
  onViewChange: (value: ProjectView) => void;
  onNewProject: () => void;
}

const ProjectListToolbar: React.FC<ProjectListToolbarProps> = ({
  search,
  sort,
  view,
  newProjectOpen,
  onSearchChange,
  onSortChange,
  onViewChange,
  onNewProject,
}) => (
  <div className="shrink-0 border-b border-zinc-200 p-3 dark:border-zinc-800">
    <div className="mb-2 flex flex-wrap gap-1">
      {PROJECT_VIEWS.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onViewChange(option.value)}
          className={`h-7 shrink-0 rounded-md px-2 text-[11px] font-semibold transition-colors ${
            view === option.value
              ? 'bg-zinc-900 text-white dark:bg-[var(--accent-600)]'
              : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>

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
          value={search}
          onChange={event => onSearchChange(event.target.value)}
          placeholder="Search projects…"
          className="h-8 w-full rounded-lg border border-zinc-200 bg-white pl-7 pr-7 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
        />
        {search && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Clear project search"
            className="absolute right-1.5 top-1/2 inline-flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
          >
            <X size={12} />
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onNewProject}
        aria-expanded={newProjectOpen}
        aria-label={newProjectOpen ? 'Cancel new project' : 'New project'}
        title={newProjectOpen ? 'Cancel' : 'New project'}
        className={`inline-flex h-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
          newProjectOpen
            ? 'w-8 border-[var(--accent-400)] bg-[var(--accent-50)] text-[var(--accent-600)] dark:border-[var(--accent-600)] dark:bg-zinc-900'
            : 'w-8 border-zinc-200 text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900 xl:w-auto xl:gap-1.5 xl:px-2.5'
        }`}
      >
        {newProjectOpen ? <X size={14} /> : <Plus size={14} />}
        {!newProjectOpen && <span className="hidden text-xs font-semibold xl:inline">New</span>}
      </button>
    </div>

    <select
      aria-label="Sort projects"
      value={sort}
      onChange={event => onSortChange(event.target.value as ProjectSort)}
      className="mt-2 h-7 w-full rounded-md border border-zinc-200 bg-white px-2 text-[11px] text-zinc-600 focus:outline-none focus:ring-1 focus:ring-[var(--accent-100)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
    >
      {SORT_OPTIONS.map(option => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  </div>
);

export default ProjectListToolbar;
