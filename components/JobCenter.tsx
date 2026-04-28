/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * JobCenter.tsx — Global job/progress drawer
 */

import React, { useMemo, useState } from 'react';
import { Activity, AlertCircle, Ban, CheckCircle2, Clock, Loader2, Trash2, X } from 'lucide-react';
import { formatJobType, isJobActive, isJobComplete, isJobFailed, JobRecord, useJobs } from './JobProvider';
import { cancelJob } from '../api';

/** Clamp progress values to the 0-100 range used by the UI. */
function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

/** Format a timestamp as a compact relative age label. */
function formatRelativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';
  const diffMs = Date.now() - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return new Date(value).toLocaleDateString();
}

/** Convert a job status into display text. */
function statusLabel(job: JobRecord): string {
  const status = job.status.toLowerCase();
  if (status === 'processing' || status === 'running' || status === 'rendering') return 'Running';
  if (status === 'complete' || status === 'completed' || status === 'done') return 'Complete';
  if (status === 'error' || status === 'failed') return 'Failed';
  if (status === 'cancelled' || status === 'canceled') return 'Canceled';
  return job.status.charAt(0).toUpperCase() + job.status.slice(1);
}

/** Return badge color classes for a job status. */
function statusClasses(job: JobRecord): string {
  if (isJobFailed(job)) return 'bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800';
  if (isJobComplete(job)) return 'bg-emerald-50 dark:bg-emerald-900/25 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
  if (isJobActive(job)) return 'bg-[var(--accent-50)] dark:bg-zinc-800 text-[var(--accent-700)] dark:text-[var(--accent-100)] border-[var(--accent-100)] dark:border-zinc-700';
  return 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700';
}

/** Render the icon that represents a job's current status. */
function JobIcon({ job }: { job: JobRecord }) {
  if (isJobFailed(job)) return <AlertCircle size={16} className="text-red-500 dark:text-red-400" />;
  if (isJobComplete(job)) return <CheckCircle2 size={16} className="text-emerald-500 dark:text-emerald-400" />;
  if (isJobActive(job)) return <Loader2 size={16} className="animate-spin text-[var(--accent-500)]" />;
  return <Clock size={16} className="text-zinc-400" />;
}

/** Render one row in the job center popover. */
function JobRow({ job, onDismiss }: { job: JobRecord; onDismiss: (id: string) => void }) {
  const percent = clampPercent(job.percent);
  const hasItemProgress = typeof job.completed_items === 'number' && typeof job.total_items === 'number' && job.total_items > 0;
  const [cancelling, setCancelling] = useState(false);
  const canCancel = isJobActive(job) && job.type === 'batch_render';

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await cancelJob(job.id);
    } catch {
      // Ignore — cancellation is best-effort
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/70 p-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700">
          <JobIcon job={job} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{formatJobType(job.type)}</p>
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-zinc-500 dark:text-zinc-400">
                {job.message || statusLabel(job)}
              </p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClasses(job)}`}>
              {statusLabel(job)}
            </span>
          </div>

          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-full rounded-full ${isJobFailed(job) ? 'bg-red-500' : isJobComplete(job) ? 'bg-emerald-500' : 'accent-bg'}`}
              style={{ width: `${percent}%` }}
            />
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-zinc-400 dark:text-zinc-500">
            <span>{hasItemProgress ? `${job.completed_items} / ${job.total_items}` : `${Math.round(percent)}%`}</span>
            <div className="flex items-center gap-1.5">
              {canCancel && (
                <button
                  onClick={handleCancel}
                  disabled={cancelling}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold text-zinc-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  aria-label="Cancel job"
                  title="Cancel render"
                >
                  {cancelling ? <Loader2 size={10} className="animate-spin" /> : <Ban size={10} />}
                  Cancel
                </button>
              )}
              <span>{formatRelativeTime(job.updated_at)}</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => onDismiss(job.id)}
          className="shrink-0 rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
          aria-label="Dismiss job"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/** Hook for components that need to show a Jobs badge/indicator without rendering the full drawer. */
export function useJobBadge() {
  const { activeJobs, failedJobs } = useJobs();
  const badgeCount = failedJobs.length > 0 ? failedJobs.length : activeJobs.length;
  const latestActive = activeJobs[0];
  const latestPercent = latestActive ? clampPercent(latestActive.percent) : 0;
  return {
    badgeCount,
    hasActive: activeJobs.length > 0,
    hasFailed: failedJobs.length > 0,
    latestPercent,
  };
}

interface JobCenterProps {
  open: boolean;
  onClose: () => void;
}

/** Render the job/progress drawer. Trigger button lives in the sidebar. */
const JobCenter: React.FC<JobCenterProps> = ({ open, onClose }) => {
  const { jobs, activeJobs, failedJobs, finishedJobs, connectionStatus, clearFinished, dismissJob } = useJobs();

  const recentJobs = useMemo(() => jobs.slice(0, 8), [jobs]);
  const showConnectionFallback = connectionStatus === 'disconnected' || connectionStatus === 'reconnecting';

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[65]">
          <div className="absolute inset-0 bg-zinc-950/30 backdrop-blur-sm xl:bg-transparent xl:backdrop-blur-0" onClick={onClose} />
          <section
            className="absolute inset-x-3 top-3 bottom-16 xl:left-auto xl:right-4 xl:top-16 xl:bottom-4 xl:w-[390px] rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden flex flex-col animate-slide-up"
            role="dialog"
            aria-modal="true"
            aria-labelledby="job-center-title"
          >
            <header className="flex items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Activity size={18} className="text-[var(--accent-500)] shrink-0" />
                <div className="min-w-0">
                  <h2 id="job-center-title" className="truncate text-sm font-bold text-zinc-900 dark:text-white">Job Center</h2>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {activeJobs.length > 0 ? `${activeJobs.length} active` : finishedJobs.length > 0 ? `${finishedJobs.length} finished` : 'Idle'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {finishedJobs.length > 0 && (
                  <button
                    onClick={clearFinished}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  >
                    <Trash2 size={13} />
                    Clear
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
                  aria-label="Close job center"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {showConnectionFallback && (
              <div className="border-b border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/25 px-4 py-2 text-xs font-medium text-amber-800 dark:text-amber-200">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 shrink-0" />
                  <span>Live progress disconnected. Job history will refresh periodically.</span>
                </div>
              </div>
            )}

            <div className="flex-1 overflow-y-auto p-4">
              {recentJobs.length === 0 ? (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                    <Activity size={22} className="text-zinc-400" />
                  </div>
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-200">No jobs yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentJobs.map(job => (
                    <JobRow key={job.id} job={job} onDismiss={dismissJob} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </>
  );
};

export default JobCenter;
