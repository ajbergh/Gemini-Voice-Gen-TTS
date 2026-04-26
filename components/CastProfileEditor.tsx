/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CastProfileEditor.tsx — Modal for creating or editing a cast profile.
 *
 * All fields map directly to the CastProfile schema. Sample lines are
 * stored as a JSON array in `sample_lines_json`; this component exposes
 * them as a newline-separated textarea for ease of entry.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, History, Loader2, RotateCcw, X } from 'lucide-react';
import { createCastProfile, listCastProfileVersions, revertCastProfileVersion, updateCastProfile } from '../api';
import {
  CastProfile,
  CastProfileVersion,
  CastRole,
  CreateCastProfileInput,
  Voice,
} from '../types';
import { useToast } from './ToastProvider';

interface CastProfileEditorProps {
  projectId: number;
  /** Pass an existing profile to edit it; omit to create a new one. */
  profile?: CastProfile;
  voices: Voice[];
  /** Pre-select a role when creating a profile from a specific group. */
  initialRole?: CastRole;
  onSave: (saved: CastProfile) => void;
  onClose: () => void;
}

const ROLES: { value: CastRole; label: string }[] = [
  { value: 'narrator',    label: 'Narrator' },
  { value: 'protagonist', label: 'Protagonist' },
  { value: 'antagonist',  label: 'Antagonist' },
  { value: 'supporting',  label: 'Supporting' },
  { value: 'extra',       label: 'Extra' },
  { value: 'brand_voice', label: 'Brand Voice' },
  { value: 'archived',    label: 'Archived' },
];

const CastProfileEditor: React.FC<CastProfileEditorProps> = ({
  projectId,
  profile,
  voices,
  initialRole,
  onSave,
  onClose,
}) => {
  const { showToast } = useToast();
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const [name, setName]                       = useState(profile?.name ?? '');
  const [role, setRole]                       = useState<string>(profile?.role ?? initialRole ?? 'narrator');
  const [description, setDescription]         = useState(profile?.description ?? '');
  const [voiceName, setVoiceName]             = useState(profile?.voice_name ?? '');
  const [languageCode, setLanguageCode]       = useState(profile?.language_code ?? '');
  const [ageImpression, setAgeImpression]     = useState(profile?.age_impression ?? '');
  const [emotionalRange, setEmotionalRange]   = useState(profile?.emotional_range ?? '');
  const [pronunciationNotes, setPronunciationNotes] = useState(profile?.pronunciation_notes ?? '');

  // sample_lines_json is a JSON array; expose as newline-separated text
  const [sampleLines, setSampleLines] = useState<string>(() => {
    if (!profile?.sample_lines_json) return '';
    try { return (JSON.parse(profile.sample_lines_json) as string[]).join('\n'); } catch { return ''; }
  });

  const [saving, setSaving] = useState(false);

  // Version history (editing an existing profile only)
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [versions, setVersions] = useState<CastProfileVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [revertingVersionId, setRevertingVersionId] = useState<number | null>(null);

  const firstFocusRef = useRef<HTMLInputElement>(null);
  useEffect(() => { firstFocusRef.current?.focus(); }, []);

  // Load version history when the section is first expanded.
  async function handleToggleVersionHistory() {
    if (!profile) return;
    const next = !showVersionHistory;
    setShowVersionHistory(next);
    if (next && versions.length === 0) {
      setLoadingVersions(true);
      try {
        const data = await listCastProfileVersions(profile.id);
        if (isMounted.current) setVersions(data);
      } catch {
        // silently ignore — the section will just show empty
      } finally {
        if (isMounted.current) setLoadingVersions(false);
      }
    }
  }

  async function handleRevert(versionId: number) {
    if (!profile) return;
    setRevertingVersionId(versionId);
    try {
      const reverted = await revertCastProfileVersion(profile.id, versionId);
      if (!isMounted.current) return;
      showToast('Reverted to earlier version.', 'success');
      onSave(reverted);
    } catch (err: any) {
      if (!isMounted.current) return;
      showToast(err?.message ?? 'Revert failed.', 'error');
    } finally {
      if (isMounted.current) setRevertingVersionId(null);
    }
  }

  function handleBackdropKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }

  async function handleSave() {
    if (!name.trim()) {
      showToast('Character name is required.', 'error');
      return;
    }
    setSaving(true);
    try {
      const lines = sampleLines.split('\n').map(l => l.trim()).filter(Boolean);
      const data: CreateCastProfileInput = {
        name:                name.trim(),
        role,
        description,
        voice_name:          voiceName || undefined,
        language_code:       languageCode || undefined,
        age_impression:      ageImpression || undefined,
        emotional_range:     emotionalRange || undefined,
        pronunciation_notes: pronunciationNotes || undefined,
        sample_lines_json:   lines.length ? JSON.stringify(lines) : undefined,
      };
      const saved = profile
        ? await updateCastProfile(profile.id, data)
        : await createCastProfile(projectId, data);
      if (!isMounted.current) return;
      onSave(saved);
    } catch (err: any) {
      if (!isMounted.current) return;
      showToast(err?.message ?? 'Failed to save profile.', 'error');
    } finally {
      if (isMounted.current) setSaving(false);
    }
  }

  const inputCls = 'h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]';
  const textareaCls = 'w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]';
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cast-editor-title"
      onKeyDown={handleBackdropKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-900 shrink-0">
          <h2
            id="cast-editor-title"
            className="text-lg font-semibold text-zinc-900 dark:text-white"
          >
            {profile ? 'Edit character' : 'New character'}
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
              placeholder="Character or narrator name"
              className={inputCls}
            />
          </div>

          {/* Role */}
          <div className="space-y-1">
            <label className={labelCls}>Role</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
            >
              {ROLES.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Voice */}
          <div className="space-y-1">
            <label className={labelCls}>Voice</label>
            <select
              value={voiceName}
              onChange={e => setVoiceName(e.target.value)}
              className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
            >
              <option value="">— None (use project default) —</option>
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className={labelCls}>Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Who is this character? What's their personality and speech pattern?"
              className={textareaCls}
            />
          </div>

          {/* Age impression + Emotional range */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className={labelCls}>Age impression</label>
              <input
                value={ageImpression}
                onChange={e => setAgeImpression(e.target.value)}
                placeholder="e.g. Mid-40s, world-weary"
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className={labelCls}>Emotional range</label>
              <input
                value={emotionalRange}
                onChange={e => setEmotionalRange(e.target.value)}
                placeholder="e.g. Warm, dry humour"
                className={inputCls}
              />
            </div>
          </div>

          {/* Language code */}
          <div className="space-y-1">
            <label className={labelCls}>Language code</label>
            <input
              value={languageCode}
              onChange={e => setLanguageCode(e.target.value)}
              placeholder="e.g. en-US  (overrides project default)"
              className={inputCls}
            />
          </div>

          {/* Sample lines */}
          <div className="space-y-1">
            <label className={labelCls}>
              Sample lines{' '}
              <span className="text-zinc-400 dark:text-zinc-500 normal-case font-normal">(one per line — used for auditions)</span>
            </label>
            <textarea
              value={sampleLines}
              onChange={e => setSampleLines(e.target.value)}
              rows={3}
              placeholder={'e.g. The silence before dawn holds its breath.\nWe are none of us what we appear.'}
              className={textareaCls}
            />
          </div>

          {/* Pronunciation notes */}
          <div className="space-y-1">
            <label className={labelCls}>Pronunciation notes</label>
            <textarea
              value={pronunciationNotes}
              onChange={e => setPronunciationNotes(e.target.value)}
              rows={2}
              placeholder="e.g. Emphasise the second syllable in 'Aelindra'. Stress 'NOT' in negatives."
              className={textareaCls}
            />
          </div>

          {/* Version history — editing mode only */}
          {profile && (
            <div className="border border-zinc-100 dark:border-zinc-800 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={handleToggleVersionHistory}
                className="flex w-full items-center gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors"
              >
                {showVersionHistory ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                <History size={13} />
                Version history
              </button>
              {showVersionHistory && (
                <div className="border-t border-zinc-100 dark:border-zinc-800 divide-y divide-zinc-100 dark:divide-zinc-800">
                  {loadingVersions ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-xs text-zinc-400">
                      <Loader2 size={12} className="animate-spin" /> Loading…
                    </div>
                  ) : versions.length === 0 ? (
                    <p className="px-3 py-3 text-xs text-zinc-400">No snapshots saved yet.</p>
                  ) : (
                    versions.map(v => (
                      <div key={v.id} className="flex items-center justify-between gap-3 px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{v.name}</p>
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                            {new Date(v.created_at).toLocaleString(undefined, {
                              year: 'numeric', month: 'short', day: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })}
                            {v.voice_name ? ` · ${v.voice_name}` : ''}
                            {v.role ? ` · ${v.role}` : ''}
                          </p>
                        </div>
                        <button
                          type="button"
                          title="Revert to this version"
                          disabled={revertingVersionId === v.id}
                          onClick={() => handleRevert(v.id)}
                          className="shrink-0 inline-flex h-7 items-center gap-1 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                          {revertingVersionId === v.id
                            ? <Loader2 size={10} className="animate-spin" />
                            : <RotateCcw size={10} />}
                          Revert
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
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-900 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-4 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
            {profile ? 'Save changes' : 'Create character'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CastProfileEditor;
