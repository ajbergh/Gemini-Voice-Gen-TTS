/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * StylePresetEditor.tsx — Modal for creating or editing a performance style preset.
 *
 * Fields: name (required), description, category, pacing, energy, emotion,
 * articulation, pause_density, director_notes. In edit mode a collapsible
 * version history section allows reverting to a prior snapshot.
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, History, Loader2, RotateCcw, X } from 'lucide-react';
import {
  createStyle,
  listStyleVersions,
  revertStyleVersion,
  updateStyle,
} from '../api';
import {
  CreateStyleInput,
  PerformanceStyle,
  PerformanceStyleVersion,
  StyleCategory,
} from '../types';
import { useToast } from './ToastProvider';

interface StylePresetEditorProps {
  /** Pass an existing style to edit it; omit to create a new one. */
  style?: PerformanceStyle;
  /** Required for project-scoped creation. */
  projectId?: number;
  onSave: (saved: PerformanceStyle) => void;
  onClose: () => void;
}

const CATEGORIES: { value: StyleCategory; label: string }[] = [
  { value: 'narration',   label: 'Narration' },
  { value: 'commercial',  label: 'Commercial' },
  { value: 'education',   label: 'Education' },
  { value: 'character',   label: 'Character' },
  { value: 'wellness',    label: 'Wellness' },
  { value: 'documentary', label: 'Documentary' },
  { value: 'trailer',     label: 'Trailer' },
  { value: 'custom',      label: 'Custom' },
];

const PACING_OPTIONS    = ['slow', 'measured', 'conversational', 'brisk', 'rapid'];
const ENERGY_OPTIONS    = ['subdued', 'calm', 'moderate', 'engaged', 'high'];
const EMOTION_OPTIONS   = ['neutral', 'warm', 'authoritative', 'intimate', 'dramatic', 'playful', 'suspenseful'];
const ARTICULATION_OPTS = ['relaxed', 'clear', 'crisp', 'heightened'];
const PAUSE_OPTIONS     = ['sparse', 'moderate', 'frequent', 'dramatic'];

/** Render the modal editor for reusable performance style presets. */
const StylePresetEditor: React.FC<StylePresetEditorProps> = ({
  style,
  projectId,
  onSave,
  onClose,
}) => {
  const { showToast } = useToast();
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  const [name, setName]                   = useState(style?.name ?? '');
  const [description, setDescription]     = useState(style?.description ?? '');
  const [category, setCategory]           = useState<string>(style?.category ?? 'custom');
  const [pacing, setPacing]               = useState(style?.pacing ?? '');
  const [energy, setEnergy]               = useState(style?.energy ?? '');
  const [emotion, setEmotion]             = useState(style?.emotion ?? '');
  const [articulation, setArticulation]   = useState(style?.articulation ?? '');
  const [pauseDensity, setPauseDensity]   = useState(style?.pause_density ?? '');
  const [directorNotes, setDirectorNotes] = useState(style?.director_notes ?? '');

  const [saving, setSaving] = useState(false);

  // Version history (edit mode only)
  const [showVersions, setShowVersions]       = useState(false);
  const [versions, setVersions]               = useState<PerformanceStyleVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [revertingId, setRevertingId]         = useState<number | null>(null);

  const firstFocusRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstFocusRef.current?.focus(); }, []);

  // Focus trap
  const panelRef = useRef<HTMLDivElement>(null);
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'Tab') {
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus(); }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    }
  }

  async function handleToggleVersions() {
    if (!style) return;
    const next = !showVersions;
    setShowVersions(next);
    if (next && versions.length === 0) {
      setLoadingVersions(true);
      try {
        const data = await listStyleVersions(style.id);
        if (isMounted.current) setVersions(data);
      } catch {
        // silently ignore — section shows empty
      } finally {
        if (isMounted.current) setLoadingVersions(false);
      }
    }
  }

  async function handleRevert(versionId: number) {
    if (!style) return;
    setRevertingId(versionId);
    try {
      const reverted = await revertStyleVersion(style.id, versionId);
      if (!isMounted.current) return;
      showToast('Reverted to earlier version.', 'success');
      onSave(reverted);
    } catch (err: any) {
      if (!isMounted.current) return;
      showToast(err?.message ?? 'Revert failed.', 'error');
    } finally {
      if (isMounted.current) setRevertingId(null);
    }
  }

  async function handleSave() {
    if (!name.trim()) {
      showToast('Style name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const data: CreateStyleInput = {
        name: name.trim(),
        description: description || undefined,
        category: category || undefined,
        pacing: pacing || undefined,
        energy: energy || undefined,
        emotion: emotion || undefined,
        articulation: articulation || undefined,
        pause_density: pauseDensity || undefined,
        director_notes: directorNotes || undefined,
        project_id: projectId,
      } as CreateStyleInput;

      const saved = style
        ? await updateStyle(style.id, data)
        : await createStyle(data);

      if (!isMounted.current) return;
      onSave(saved);
    } catch (err: any) {
      if (!isMounted.current) return;
      showToast(err?.message ?? 'Failed to save style.', 'error');
    } finally {
      if (isMounted.current) setSaving(false);
    }
  }

  const inputCls = 'h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]';
  const selectCls = 'h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]';
  const textareaCls = 'w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]';
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="style-editor-title"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-900 shrink-0">
          <h2 id="style-editor-title" className="text-lg font-semibold text-zinc-900 dark:text-white">
            {style ? 'Edit style' : 'New style'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
            aria-label="Close editor"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Name */}
          <div className="space-y-1">
            <label className={labelCls}>
              Name <span className="text-red-500 normal-case">*</span>
            </label>
            <input
              ref={firstFocusRef}
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Intimate Narration"
              className={inputCls}
            />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className={labelCls}>Description</label>
            <input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Short description of when to use this style"
              className={inputCls}
            />
          </div>

          {/* Category */}
          <div className="space-y-1">
            <label className={labelCls}>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className={selectCls}>
              {CATEGORIES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          {/* Delivery descriptors — 2-col grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Pacing</label>
              <select value={pacing} onChange={e => setPacing(e.target.value)} className={selectCls}>
                <option value="">— None —</option>
                {PACING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Energy</label>
              <select value={energy} onChange={e => setEnergy(e.target.value)} className={selectCls}>
                <option value="">— None —</option>
                {ENERGY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Emotion</label>
              <select value={emotion} onChange={e => setEmotion(e.target.value)} className={selectCls}>
                <option value="">— None —</option>
                {EMOTION_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Articulation</label>
              <select value={articulation} onChange={e => setArticulation(e.target.value)} className={selectCls}>
                <option value="">— None —</option>
                {ARTICULATION_OPTS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div className="space-y-1 col-span-2">
              <label className={labelCls}>Pause density</label>
              <select value={pauseDensity} onChange={e => setPauseDensity(e.target.value)} className={selectCls}>
                <option value="">— None —</option>
                {PAUSE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          </div>

          {/* Director's notes */}
          <div className="space-y-1">
            <label className={labelCls}>Director's notes</label>
            <textarea
              value={directorNotes}
              onChange={e => setDirectorNotes(e.target.value)}
              rows={3}
              placeholder="Free-form instruction passed directly to the TTS model system prompt…"
              className={textareaCls}
            />
          </div>

          {/* Version history — edit mode only */}
          {style && (
            <div className="border border-zinc-100 dark:border-zinc-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={handleToggleVersions}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                {showVersions ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <History size={13} />
                Version history
              </button>
              {showVersions && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-2 space-y-2 max-h-48 overflow-y-auto">
                  {loadingVersions ? (
                    <div className="flex items-center gap-2 py-2 text-sm text-zinc-400">
                      <Loader2 size={14} className="animate-spin" />
                      Loading…
                    </div>
                  ) : versions.length === 0 ? (
                    <p className="text-sm text-zinc-400 py-1">No saved versions yet.</p>
                  ) : (
                    versions.map(v => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between gap-2 text-xs text-zinc-600 dark:text-zinc-300 py-1"
                      >
                        <div className="min-w-0">
                          <span className="font-medium truncate block">{v.name}</span>
                          <span className="text-zinc-400 dark:text-zinc-500">
                            {new Date(v.created_at).toLocaleString()}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRevert(v.id)}
                          disabled={revertingId === v.id}
                          title="Revert to this version"
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 disabled:opacity-50 transition-colors"
                        >
                          {revertingId === v.id
                            ? <Loader2 size={12} className="animate-spin" />
                            : <RotateCcw size={12} />
                          }
                        </button>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 dark:border-zinc-900 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent-100)] text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {style ? 'Save changes' : 'Create style'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StylePresetEditor;
