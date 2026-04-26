/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { CONFIG_KEYS, createQcIssue, getConfig, updateQcIssue } from '../api';
import type {
  CreateQcIssueInput,
  QcIssue,
  QcIssueType,
  QcIssueSeverity,
  UpdateQcIssueInput,
} from '../types';

interface QcIssueDialogProps {
  projectId: number;
  segmentId: number;
  /** Pre-fill with existing issue data when editing. Omit for create mode. */
  issue?: QcIssue;
  /** Optional take ID to attach the issue to. */
  takeId?: number;
  /** Optional playback position in seconds to pre-fill time offset. */
  timeOffset?: number;
  onSave: (issue: QcIssue) => void;
  onClose: () => void;
  isDarkMode?: boolean;
}

const ISSUE_TYPE_OPTIONS: { value: QcIssueType; label: string }[] = [
  { value: 'pronunciation', label: 'Pronunciation' },
  { value: 'pacing', label: 'Pacing' },
  { value: 'tone', label: 'Tone' },
  { value: 'volume', label: 'Volume' },
  { value: 'artifact', label: 'Audio Artifact' },
  { value: 'missing_pause', label: 'Missing Pause' },
  { value: 'wrong_voice', label: 'Wrong Voice' },
  { value: 'bad_emphasis', label: 'Bad Emphasis' },
  { value: 'other', label: 'Other' },
];

const SEVERITY_OPTIONS: { value: QcIssueSeverity; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-blue-500' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
  { value: 'high', label: 'High', color: 'text-red-500' },
];

export default function QcIssueDialog({
  projectId,
  segmentId,
  issue,
  takeId,
  timeOffset,
  onSave,
  onClose,
  isDarkMode = false,
}: QcIssueDialogProps) {
  const isEdit = !!issue;
  const [issueType, setIssueType] = useState<QcIssueType>(issue?.issue_type ?? 'other');
  const [severity, setSeverity] = useState<QcIssueSeverity>(issue?.severity ?? 'medium');
  const [note, setNote] = useState(issue?.note ?? '');
  const [offsetSeconds, setOffsetSeconds] = useState<string>(
    issue?.time_offset_seconds != null
      ? String(issue.time_offset_seconds)
      : timeOffset != null
      ? String(timeOffset.toFixed(3))
      : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLSelectElement>(null);

  // Focus trap
  useEffect(() => {
    firstFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    if (issue) return;
    let mounted = true;
    getConfig().then(cfg => {
      if (!mounted) return;
      const configured = cfg[CONFIG_KEYS.QC_DEFAULT_SEVERITY] as QcIssueSeverity | undefined;
      if (configured === 'low' || configured === 'medium' || configured === 'high') {
        setSeverity(configured);
      }
    }).catch(() => {});
    return () => { mounted = false; };
  }, [issue]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const offset = offsetSeconds !== '' ? parseFloat(offsetSeconds) : undefined;
    try {
      let saved: QcIssue;
      if (isEdit) {
        const update: UpdateQcIssueInput = { issue_type: issueType, severity, note, time_offset_seconds: offset ?? null, take_id: takeId ?? null };
        saved = await updateQcIssue(issue!.id, update);
      } else {
        const input: CreateQcIssueInput = { segment_id: segmentId, issue_type: issueType, severity, note, time_offset_seconds: offset, take_id: takeId };
        saved = await createQcIssue(projectId, input);
      }
      onSave(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save issue');
    } finally {
      setSaving(false);
    }
  }, [isEdit, issue, projectId, segmentId, issueType, severity, note, offsetSeconds, takeId, onSave]);

  const base = isDarkMode ? 'bg-zinc-900 text-zinc-100 border-zinc-700' : 'bg-white text-zinc-900 border-zinc-200';
  const inputCls = `w-full rounded-lg px-3 py-2 text-sm border ${isDarkMode ? 'bg-zinc-800 border-zinc-600 text-zinc-100' : 'bg-white border-zinc-300 text-zinc-900'} focus:outline-none focus:ring-2 focus:ring-blue-500`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="qc-dialog-title">
      <div ref={dialogRef} className={`relative w-full max-w-md rounded-2xl border shadow-2xl p-6 ${base}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 id="qc-dialog-title" className="text-lg font-semibold">{isEdit ? 'Edit QC Issue' : 'Flag QC Issue'}</h2>
          <button onClick={onClose} aria-label="Close" className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Issue type */}
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Issue Type</label>
            <select ref={firstFocusRef} value={issueType} onChange={e => setIssueType(e.target.value as QcIssueType)} className={inputCls}>
              {ISSUE_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Severity */}
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Severity</label>
            <div className="flex gap-2">
              {SEVERITY_OPTIONS.map(o => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSeverity(o.value)}
                  className={`flex-1 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                    severity === o.value
                      ? `${o.color} ${isDarkMode ? 'bg-zinc-700 border-zinc-500' : 'bg-zinc-100 border-zinc-400'}`
                      : `${isDarkMode ? 'border-zinc-700 hover:bg-zinc-800' : 'border-zinc-200 hover:bg-zinc-50'} opacity-60`
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Note</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Describe the issue…"
              className={`${inputCls} resize-none`}
            />
          </div>

          {/* Time offset */}
          <div>
            <label className="block text-xs font-medium mb-1 opacity-70">Time Offset (seconds, optional)</label>
            <input
              type="number"
              step="0.001"
              min="0"
              value={offsetSeconds}
              onChange={e => setOffsetSeconds(e.target.value)}
              placeholder="e.g. 12.500"
              className={inputCls}
            />
          </div>

          {error && <p className="text-red-500 text-xs">{error}</p>}

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={onClose} className={`flex-1 py-2 rounded-xl text-sm font-medium border ${isDarkMode ? 'border-zinc-700 hover:bg-zinc-800' : 'border-zinc-200 hover:bg-zinc-100'}`}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 rounded-xl text-sm font-medium bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Flag Issue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
