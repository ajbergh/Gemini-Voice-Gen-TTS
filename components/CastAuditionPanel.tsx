/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CastAuditionPanel.tsx — Modal panel for test-playing a cast profile's voice.
 *
 * Pre-fills the sample text from the profile's first sample line if available.
 * Calls POST /api/cast/{profileId}/audition and plays the resulting PCM audio
 * through the shared AudioProvider.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Mic, X } from 'lucide-react';
import { auditionCastProfile } from '../api';
import { CastAuditionInput, CastProfile, Voice } from '../types';
import { useAudio } from './AudioProvider';
import { useToast } from './ToastProvider';

interface CastAuditionPanelProps {
  profile: CastProfile;
  voices: Voice[];
  onClose: () => void;
}

/** Render the cast-profile audition form and generated audio preview. */
const CastAuditionPanel: React.FC<CastAuditionPanelProps> = ({
  profile,
  voices,
  onClose,
}) => {
  const { showToast } = useToast();
  const { playPcm } = useAudio();
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  // Pre-fill with the first sample line when available
  const defaultSampleText = (() => {
    try {
      const lines: string[] = JSON.parse(profile.sample_lines_json ?? '[]');
      return lines[0] ?? '';
    } catch { return ''; }
  })();

  const [sampleText, setSampleText]       = useState(defaultSampleText || `Hello, my name is ${profile.name}.`);
  const [voiceOverride, setVoiceOverride] = useState(profile.voice_name ?? '');
  const [auditioning, setAuditioning]     = useState(false);

  // Escape key to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { textareaRef.current?.focus(); }, []);

  async function handleAudition() {
    if (!sampleText.trim()) {
      showToast('Enter some sample text to audition.', 'error');
      return;
    }
    setAuditioning(true);
    try {
      const input: CastAuditionInput = {
        sample_text: sampleText.trim(),
        voice_name:  voiceOverride || undefined,
      };
      const res = await auditionCastProfile(profile.id, input);
      if (!isMounted.current) return;
      await playPcm(res.audioBase64, {
        label:    `${profile.name} — audition`,
        subtitle: sampleText.trim().slice(0, 80),
        source:   'tts',
      });
    } catch (err: any) {
      if (!isMounted.current) return;
      showToast(err?.message ?? 'Audition failed.', 'error');
    } finally {
      if (isMounted.current) setAuditioning(false);
    }
  }

  const inputCls = 'h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]';
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="cast-audition-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-5 pt-4 pb-3 border-b border-zinc-100 dark:border-zinc-900">
          <div className="flex items-center gap-2 min-w-0">
            <Mic size={15} className="shrink-0 text-indigo-500 dark:text-indigo-400" />
            <h2
              id="cast-audition-title"
              className="text-base font-semibold text-zinc-900 dark:text-white truncate"
            >
              Audition — {profile.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
            aria-label="Close audition panel"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Voice */}
          <div className="space-y-1">
            <label className={labelCls}>Voice</label>
            <select
              value={voiceOverride}
              onChange={e => setVoiceOverride(e.target.value)}
              className={inputCls}
            >
              <option value="">
                — Profile default ({profile.voice_name ?? 'project default'}) —
              </option>
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </select>
          </div>

          {/* Sample text */}
          <div className="space-y-1">
            <label className={labelCls}>Sample text</label>
            <textarea
              ref={textareaRef}
              value={sampleText}
              onChange={e => setSampleText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
            />
          </div>

          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            Audio plays through the shared player — adjust volume from the mini-player bar at the bottom.
          </p>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-100 dark:border-zinc-900">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            disabled={auditioning || !sampleText.trim()}
            onClick={handleAudition}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-indigo-600 dark:bg-indigo-500 px-4 text-xs font-semibold text-white hover:bg-indigo-500 dark:hover:bg-indigo-400 transition-colors disabled:opacity-50"
          >
            {auditioning
              ? <Loader2 size={13} className="animate-spin" />
              : <Mic size={13} />}
            {auditioning ? 'Generating…' : 'Play audition'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CastAuditionPanel;
