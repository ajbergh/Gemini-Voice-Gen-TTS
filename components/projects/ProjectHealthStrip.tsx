/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, CircleDot, FileText, ShieldAlert, Users, Volume2 } from 'lucide-react';
import { ProjectHealth, ProjectNextAction } from './projectHealth';

interface ProjectHealthStripProps {
  health: ProjectHealth;
  compact?: boolean;
  onNextAction: (action: ProjectNextAction) => void;
}

const STATUS_STYLES: Record<ProjectHealth['status'], string> = {
  empty: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  needs_script: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300',
  needs_cast: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  needs_render: 'bg-[var(--accent-100)] text-[var(--accent-700)] dark:bg-zinc-900 dark:text-[var(--accent-100)]',
  needs_review: 'bg-[var(--accent-100)] text-[var(--accent-700)] dark:bg-zinc-900 dark:text-[var(--accent-100)]',
  blocked_qc: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200',
  ready_export: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200',
};

function statusIcon(status: ProjectHealth['status']) {
  switch (status) {
    case 'ready_export':
      return <CheckCircle2 size={13} aria-hidden="true" />;
    case 'blocked_qc':
      return <ShieldAlert size={13} aria-hidden="true" />;
    case 'needs_cast':
      return <Users size={13} aria-hidden="true" />;
    case 'needs_render':
      return <Volume2 size={13} aria-hidden="true" />;
    case 'needs_review':
      return <CircleDot size={13} aria-hidden="true" />;
    default:
      return <FileText size={13} aria-hidden="true" />;
  }
}

const ProjectHealthStrip: React.FC<ProjectHealthStripProps> = ({ health, compact = false, onNextAction }) => {
  const renderedPercent = health.segmentCount > 0
    ? Math.min(100, Math.round((health.renderedCount / health.segmentCount) * 100))
    : 0;
  const approvedPercent = health.renderedCount > 0
    ? Math.min(100, Math.round((health.approvedCount / health.renderedCount) * 100))
    : 0;

  return (
    <div className={`mt-3 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950 ${compact ? 'space-y-2' : 'flex flex-wrap items-center gap-3'}`}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold ${STATUS_STYLES[health.status]}`}>
          {statusIcon(health.status)}
          {health.label}
        </span>
        <span className="min-w-0 text-xs text-zinc-600 dark:text-zinc-300">
          {health.detail}
        </span>
      </div>

      <div className={`flex ${compact ? 'w-full' : 'min-w-[16rem]'} items-center gap-2`}>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            <span>Rendered {health.renderedCount}/{health.segmentCount}</span>
            <span>Approved {health.approvedCount}/{Math.max(health.renderedCount, 0)}</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-[var(--accent-500)]" style={{ width: `${renderedPercent}%` }} />
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${approvedPercent}%` }} />
          </div>
        </div>
      </div>

      {health.openQcCount > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <AlertTriangle size={12} aria-hidden="true" />
          {health.openQcCount} QC
        </span>
      )}

      <button
        type="button"
        onClick={() => onNextAction(health.nextAction)}
        className="inline-flex h-8 shrink-0 items-center justify-center rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white transition-colors hover:bg-zinc-700 dark:bg-[var(--accent-600)] dark:hover:bg-[var(--accent-500)]"
      >
        {health.nextAction.label}
      </button>
    </div>
  );
};

export default ProjectHealthStrip;
