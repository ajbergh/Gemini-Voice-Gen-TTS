/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * QcRulesSettings.tsx - Settings panel for default review/QC behavior.
 *
 * Reads and writes backend config keys that control default issue severity,
 * clipping warnings, approval export policy, and QC note export format.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, ClipboardCheck, Loader2, Save } from 'lucide-react';
import { CONFIG_KEYS, getConfig, updateConfig } from '../api';
import { QcIssueSeverity } from '../types';

interface QcRules {
  qc_default_severity: QcIssueSeverity;
  qc_auto_flag_clipping: string;
  qc_clipping_threshold_db: string;
  qc_export_only_approved: string;
  qc_export_notes_format: 'csv' | 'markdown';
}

const DEFAULT_QC_RULES: QcRules = {
  qc_default_severity: 'medium',
  qc_auto_flag_clipping: 'true',
  qc_clipping_threshold_db: '-0.1',
  qc_export_only_approved: 'false',
  qc_export_notes_format: 'csv',
};

/** Render the configurable QC defaults used by review and export flows. */
export default function QcRulesSettings() {
  const isMounted = useRef(true);
  const [rules, setRules] = useState<QcRules>(DEFAULT_QC_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isMounted.current = true;
    (async () => {
      setLoading(true);
      try {
        const cfg = await getConfig();
        if (!isMounted.current) return;
        setRules({
          qc_default_severity: (cfg[CONFIG_KEYS.QC_DEFAULT_SEVERITY] as QcIssueSeverity) || DEFAULT_QC_RULES.qc_default_severity,
          qc_auto_flag_clipping: cfg[CONFIG_KEYS.QC_AUTO_FLAG_CLIPPING] ?? DEFAULT_QC_RULES.qc_auto_flag_clipping,
          qc_clipping_threshold_db: cfg[CONFIG_KEYS.QC_CLIPPING_THRESHOLD_DB] ?? DEFAULT_QC_RULES.qc_clipping_threshold_db,
          qc_export_only_approved: cfg[CONFIG_KEYS.QC_EXPORT_ONLY_APPROVED] ?? DEFAULT_QC_RULES.qc_export_only_approved,
          qc_export_notes_format: (cfg[CONFIG_KEYS.QC_EXPORT_NOTES_FORMAT] as 'csv' | 'markdown') || DEFAULT_QC_RULES.qc_export_notes_format,
        });
      } catch {
        if (isMounted.current) setError('Failed to load QC rules.');
      } finally {
        if (isMounted.current) setLoading(false);
      }
    })();
    return () => { isMounted.current = false; };
  }, []);

  const saveRules = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await updateConfig({
        [CONFIG_KEYS.QC_DEFAULT_SEVERITY]: rules.qc_default_severity,
        [CONFIG_KEYS.QC_AUTO_FLAG_CLIPPING]: rules.qc_auto_flag_clipping,
        [CONFIG_KEYS.QC_CLIPPING_THRESHOLD_DB]: rules.qc_clipping_threshold_db,
        [CONFIG_KEYS.QC_EXPORT_ONLY_APPROVED]: rules.qc_export_only_approved,
        [CONFIG_KEYS.QC_EXPORT_NOTES_FORMAT]: rules.qc_export_notes_format,
      });
      if (isMounted.current) setMessage('QC rules saved.');
    } catch {
      if (isMounted.current) setError('Failed to save QC rules.');
    } finally {
      if (isMounted.current) setSaving(false);
    }
  };

  const toggle = (key: 'qc_auto_flag_clipping' | 'qc_export_only_approved') => {
    setRules(prev => ({ ...prev, [key]: prev[key] === 'true' ? 'false' : 'true' }));
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">QC Rules</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Defaults for review issue creation, render warnings, and QC note export behavior.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
      {message && <p className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">{message}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 size={15} className="animate-spin" /> Loading QC rules...
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-200">
              <ClipboardCheck size={16} />
              <span className="text-sm font-medium">Issue Defaults</span>
            </div>
            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Default severity</span>
              <select
                value={rules.qc_default_severity}
                onChange={e => setRules(prev => ({ ...prev, qc_default_severity: e.target.value as QcIssueSeverity }))}
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-4">
            <button
              type="button"
              role="switch"
              aria-checked={rules.qc_auto_flag_clipping === 'true'}
              onClick={() => toggle('qc_auto_flag_clipping')}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <span>
                <span className="block text-sm font-medium text-zinc-900 dark:text-white">Auto-flag clipped renders</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Create a QC issue when a render clips or exceeds the peak threshold.</span>
              </span>
              <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${rules.qc_auto_flag_clipping === 'true' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rules.qc_auto_flag_clipping === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
              </span>
            </button>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Peak flag threshold (dBFS)</span>
              <input
                type="number"
                step="0.1"
                max="0"
                value={rules.qc_clipping_threshold_db}
                onChange={e => setRules(prev => ({ ...prev, qc_clipping_threshold_db: e.target.value }))}
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white"
              />
            </label>
          </div>

          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-4">
            <button
              type="button"
              role="switch"
              aria-checked={rules.qc_export_only_approved === 'true'}
              onClick={() => toggle('qc_export_only_approved')}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <span>
                <span className="block text-sm font-medium text-zinc-900 dark:text-white">Export approved takes only</span>
                <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">When enabled, ZIP packaging skips fallback rendered takes that have not been approved.</span>
              </span>
              <span className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${rules.qc_export_only_approved === 'true' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${rules.qc_export_only_approved === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
              </span>
            </button>

            <label className="block space-y-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Default QC note export</span>
              <select
                value={rules.qc_export_notes_format}
                onChange={e => setRules(prev => ({ ...prev, qc_export_notes_format: e.target.value as 'csv' | 'markdown' }))}
                className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white"
              >
                <option value="csv">CSV</option>
                <option value="markdown">Markdown</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={saveRules}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Save QC Rules
          </button>

          {message && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-300">
              <Check size={13} /> Current rules are active for new review and export actions.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
