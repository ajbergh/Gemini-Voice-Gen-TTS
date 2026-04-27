/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ExportDialog — Modal for starting and monitoring a deliverable packaging job.
 *
 * Lets the user optionally pick a finishing profile, then starts an export job
 * via POST /api/projects/{id}/exports. Polls the job status every 2 seconds
 * while pending or running. Shows a "Download ZIP" button when complete, or an
 * error message on failure.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Loader2, Package, X } from 'lucide-react';
import { CONFIG_KEYS, downloadExport, getConfig, getExport, startExport } from '../api';
import { ExportJob } from '../types';
import ExportProfilePicker from './ExportProfilePicker';

interface ExportDialogProps {
  projectId: number;
  onClose: () => void;
}

/** Render the deliverable export modal and job polling workflow. */
export default function ExportDialog({ projectId, onClose }: ExportDialogProps) {
  const [profileId, setProfileId] = useState<number | null>(null);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [starting, setStarting] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isMounted = useRef(true);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstBtnRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    isMounted.current = true;
    firstBtnRef.current?.focus();
    return () => {
      isMounted.current = false;
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    getConfig().then(cfg => {
      if (!mounted) return;
      const raw = cfg[CONFIG_KEYS.DEFAULT_EXPORT_PROFILE_ID];
      const parsed = raw ? parseInt(raw, 10) : NaN;
      if (!Number.isNaN(parsed) && parsed > 0) {
        setProfileId(parsed);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, []);

  // Focus trap
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(el => el.offsetParent !== null);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const pollJob = useCallback((jobId: number) => {
    const tick = async () => {
      try {
        const updated = await getExport(jobId);
        if (!isMounted.current) return;
        setJob(updated);
        if (updated.status === 'pending' || updated.status === 'running') {
          pollRef.current = setTimeout(tick, 2000);
        }
      } catch {
        if (isMounted.current) setError('Failed to poll job status.');
      }
    };
    pollRef.current = setTimeout(tick, 2000);
  }, []);

  const handleStart = async () => {
    setError(null);
    setStarting(true);
    try {
      const created = await startExport(projectId, profileId ? { export_profile_id: profileId } : undefined);
      if (!isMounted.current) return;
      setJob(created);
      if (created.status === 'pending' || created.status === 'running') {
        pollJob(created.id);
      }
    } catch (err) {
      if (isMounted.current) setError(err instanceof Error ? err.message : 'Failed to start export.');
    } finally {
      if (isMounted.current) setStarting(false);
    }
  };

  const handleDownload = async () => {
    if (!job) return;
    setDownloading(true);
    try {
      await downloadExport(job.id);
    } catch (err) {
      if (isMounted.current) setError(err instanceof Error ? err.message : 'Download failed.');
    } finally {
      if (isMounted.current) setDownloading(false);
    }
  };

  const isRunning = job?.status === 'pending' || job?.status === 'running';
  const isComplete = job?.status === 'complete';
  const isFailed = job?.status === 'failed';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div
        ref={dialogRef}
        className="relative w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-2xl p-6 flex flex-col gap-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="w-5 h-5 text-indigo-500" aria-hidden="true" />
            <h2 id="export-dialog-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              Export Project
            </h2>
          </div>
          <button
            ref={firstBtnRef}
            onClick={onClose}
            aria-label="Close export dialog"
            className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Profile picker */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Finishing Profile <span className="text-zinc-400 font-normal">(optional)</span>
          </label>
          <ExportProfilePicker
            value={profileId}
            onChange={(id) => setProfileId(id)}
            disabled={!!job}
            className="w-full"
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Applies silence trim, normalization, and inter-segment padding to the exported audio.
          </p>
        </div>

        {/* Status display */}
        {job && (
          <div
            className={`rounded-xl px-4 py-3 text-sm flex items-center gap-3 ${
              isRunning
                ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                : isComplete
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
                : 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300'
            }`}
            role="status"
            aria-live="polite"
          >
            {isRunning && <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden="true" />}
            <span>
              {isRunning && 'Building ZIP archive\u2026'}
              {isComplete && 'Export complete \u2014 ready to download.'}
              {isFailed && (job.error ? `Export failed: ${job.error}` : 'Export failed.')}
            </span>
          </div>
        )}

        {/* Error banner (for API-level errors before job is created) */}
        {error && !job && (
          <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 rounded-xl px-4 py-3" role="alert">
            {error}
          </p>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {isComplete ? 'Close' : 'Cancel'}
          </button>

          {!job && (
            <button
              onClick={handleStart}
              disabled={starting}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {starting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {starting ? 'Starting\u2026' : 'Start Export'}
            </button>
          )}

          {isComplete && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-2 px-5 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
            >
              {downloading
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                : <Download className="w-4 h-4" aria-hidden="true" />}
              {downloading ? 'Downloading\u2026' : 'Download ZIP'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
