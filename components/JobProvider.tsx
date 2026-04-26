/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * JobProvider.tsx — Global progress/job state
 *
 * Normalizes persisted jobs and WebSocket progress events into the frontend
 * job list used by the global job center.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ApiJob, connectProgress, getJobs, ProgressEvent } from '../api';
import { useToast } from './ToastProvider';

export interface JobRecord {
  id: string;
  type: string;
  status: string;
  message?: string;
  percent: number;
  item_id?: string;
  project_id?: string;
  segment_id?: string;
  completed_items?: number;
  total_items?: number;
  failed_items?: number;
  error_code?: string;
  started_at: string;
  updated_at: string;
  completed_at?: string;
}

interface JobContextValue {
  jobs: JobRecord[];
  activeJobs: JobRecord[];
  failedJobs: JobRecord[];
  finishedJobs: JobRecord[];
  isConnected: boolean;
  dismissJob: (id: string) => void;
  clearFinished: () => void;
  /** Subscribe to raw progress events. Returns an unsubscribe function. */
  subscribeToProgress: (cb: (event: ProgressEvent) => void) => () => void;
}

const JobContext = createContext<JobContextValue | null>(null);

const ACTIVE_STATUSES = new Set(['queued', 'processing', 'running', 'rendering', 'paused', 'canceling']);
const COMPLETE_STATUSES = new Set(['complete', 'completed', 'done']);
const FAILED_STATUSES = new Set(['error', 'failed']);
const CANCELED_STATUSES = new Set(['cancelled', 'canceled']);

function normalizeStatus(status: string | undefined): string {
  return (status || '').toLowerCase();
}

export function isJobActive(job: Pick<JobRecord, 'status'>): boolean {
  return ACTIVE_STATUSES.has(normalizeStatus(job.status));
}

export function isJobComplete(job: Pick<JobRecord, 'status'>): boolean {
  return COMPLETE_STATUSES.has(normalizeStatus(job.status));
}

export function isJobFailed(job: Pick<JobRecord, 'status'>): boolean {
  return FAILED_STATUSES.has(normalizeStatus(job.status));
}

export function isJobFinished(job: Pick<JobRecord, 'status'>): boolean {
  const status = normalizeStatus(job.status);
  return COMPLETE_STATUSES.has(status) || FAILED_STATUSES.has(status) || CANCELED_STATUSES.has(status);
}

export function formatJobType(type: string): string {
  switch (type) {
    case 'tts':
      return 'Speech render';
    case 'tts_stream':
      return 'Streaming render';
    case 'multi_tts':
    case 'tts_multi':
      return 'Dialogue render';
    case 'recommend':
    case 'recommendation':
      return 'AI casting';
    case 'batch_render':
      return 'Batch render';
    case 'headshot':
      return 'Preset artwork';
    case 'script_prep':
      return 'Script prep';
    case 'export':
      return 'Export';
    default:
      return type
        .split(/[_-]+/)
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ') || 'Job';
  }
}

export function useJobs(): JobContextValue {
  const ctx = useContext(JobContext);
  if (!ctx) throw new Error('useJobs must be used within a JobProvider');
  return ctx;
}

function fromApiJob(job: ApiJob): JobRecord {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    message: job.message || job.error,
    percent: job.percent,
    project_id: job.project_id,
    segment_id: job.segment_id,
    completed_items: job.completed_items,
    total_items: job.total_items,
    failed_items: job.failed_items,
    error_code: job.error_code,
    started_at: job.created_at,
    updated_at: job.updated_at,
    completed_at: job.completed_at,
  };
}

export const JobProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { showToast } = useToast();
  const [jobsById, setJobsById] = useState<Record<string, JobRecord>>({});
  const [isConnected, setIsConnected] = useState(false);
  const notifiedRef = useRef<Set<string>>(new Set());
  const progressSubscribersRef = useRef<Set<(event: ProgressEvent) => void>>(new Set());

  const subscribeToProgress = useCallback((cb: (event: ProgressEvent) => void) => {
    progressSubscribersRef.current.add(cb);
    return () => { progressSubscribersRef.current.delete(cb); };
  }, []);

  const dismissJob = useCallback((id: string) => {
    setJobsById(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const clearFinished = useCallback(() => {
    setJobsById(prev => {
      const next: Record<string, JobRecord> = {};
      for (const job of Object.values(prev)) {
        if (!isJobFinished(job)) next[job.id] = job;
      }
      return next;
    });
  }, []);

  const handleProgress = useCallback((event: ProgressEvent) => {
    const status = normalizeStatus(event.status);
    if (event.type === 'system') {
      setIsConnected(status === 'connected');
      return;
    }
    // Forward raw event to any interested subscribers (e.g. ProjectWorkspace).
    progressSubscribersRef.current.forEach(cb => cb(event));

    if (!event.job_id) return;

    const now = new Date().toISOString();
    setJobsById(prev => {
      const existing = prev[event.job_id!];
      const nextJob: JobRecord = {
        id: event.job_id!,
        type: event.type || existing?.type || 'job',
        status: event.status || existing?.status || 'processing',
        message: event.message ?? existing?.message,
        percent: Number.isFinite(event.percent) ? event.percent : existing?.percent ?? 0,
        item_id: event.item_id ?? existing?.item_id,
        project_id: event.project_id ?? existing?.project_id,
        segment_id: event.segment_id ?? existing?.segment_id,
        completed_items: event.completed_items ?? existing?.completed_items,
        total_items: event.total_items ?? existing?.total_items,
        failed_items: event.failed_items ?? existing?.failed_items,
        error_code: event.error_code ?? existing?.error_code,
        started_at: existing?.started_at ?? now,
        updated_at: now,
        completed_at: isJobFinished({ status: event.status }) ? existing?.completed_at ?? now : existing?.completed_at,
      };
      return { ...prev, [nextJob.id]: nextJob };
    });

    if (isJobFinished({ status: event.status })) {
      const notifyKey = `${event.job_id}:${status}`;
      if (!notifiedRef.current.has(notifyKey)) {
        notifiedRef.current.add(notifyKey);
        if (FAILED_STATUSES.has(status)) {
          showToast(event.message || `${formatJobType(event.type)} failed`, 'error');
        } else if (COMPLETE_STATUSES.has(status)) {
          showToast(event.message || `${formatJobType(event.type)} completed`, 'success');
        }
      }
    }
  }, [showToast]);

  useEffect(() => {
    let mounted = true;
    getJobs(50).then(persisted => {
      if (!mounted) return;
      setJobsById(prev => {
        const next = { ...prev };
        for (const job of persisted) {
          next[job.id] = { ...fromApiJob(job), ...next[job.id] };
        }
        return next;
      });
    }).catch(() => {});

    const disconnect = connectProgress(handleProgress);
    return () => {
      mounted = false;
      disconnect();
    };
  }, [handleProgress]);

  const jobs = useMemo(() => (
    Object.values(jobsById).sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
  ), [jobsById]);

  const value = useMemo<JobContextValue>(() => {
    const activeJobs = jobs.filter(isJobActive);
    const failedJobs = jobs.filter(isJobFailed);
    const finishedJobs = jobs.filter(isJobFinished);
    return {
      jobs,
      activeJobs,
      failedJobs,
      finishedJobs,
      isConnected,
      dismissJob,
      clearFinished,
      subscribeToProgress,
    };
  }, [jobs, isConnected, dismissJob, clearFinished, subscribeToProgress]);

  return (
    <JobContext.Provider value={value}>
      {children}
    </JobContext.Provider>
  );
};
