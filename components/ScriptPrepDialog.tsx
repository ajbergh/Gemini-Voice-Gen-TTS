/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ScriptPrepDialog.tsx — AI Script Preparation Modal (Plan 12)
 *
 * Allows creators to paste raw manuscript text and run it through the
 * Gemini AI Script Prep API. The AI returns proposed sections, segments,
 * speaker candidates, pronunciation candidates, style suggestions, and
 * warnings. Creators can review the proposal before applying it to the
 * project (future apply flow).
 *
 * Accessibility: focus trap, Escape-to-close, ARIA dialog attributes.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScriptPrepApplyResult, ScriptPrepJob, ScriptPrepOptions, ScriptPrepResult, ScriptPrepSection } from '../types';
import { X, Sparkles, ChevronDown, ChevronRight, AlertTriangle, Info, Mic2, BookOpen, Loader2 } from 'lucide-react';
import { applyScriptPrep, prepareScript } from '../api';

// ── Props ─────────────────────────────────────────────────────────────────

interface ScriptPrepDialogProps {
  projectId: number;
  projectKind?: string;
  onClose: () => void;
  /** Called after a reviewed prep result is applied to the project. */
  onApplied?: (summary: ScriptPrepApplyResult) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Parse a script-prep job result payload, returning null for missing or invalid JSON. */
function parseResult(job: ScriptPrepJob): ScriptPrepResult | null {
  if (!job.result_json) return null;
  try { return JSON.parse(job.result_json) as ScriptPrepResult; }
  catch { return null; }
}

/** Render the AI-prepared section/segment preview tree. */
function SectionTree({ sections }: { sections: ScriptPrepSection[] }) {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));
  const toggle = (i: number) => setExpanded(prev => {
    const next = new Set(prev);
    next.has(i) ? next.delete(i) : next.add(i);
    return next;
  });

  return (
    <div className="space-y-1">
      {sections.map((sec, i) => (
        <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
          <button
            className="w-full flex items-center gap-2 px-3 py-2 text-left bg-zinc-50 dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors"
            onClick={() => toggle(i)}
            aria-expanded={expanded.has(i)}
          >
            {expanded.has(i)
              ? <ChevronDown className="w-4 h-4 text-zinc-400 shrink-0" />
              : <ChevronRight className="w-4 h-4 text-zinc-400 shrink-0" />}
            <span className="font-medium text-sm text-zinc-800 dark:text-zinc-200 truncate">{sec.title || `Section ${i + 1}`}</span>
            <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500 shrink-0">{sec.kind} · {sec.segments.length} seg</span>
          </button>
          {expanded.has(i) && (
            <div className="divide-y divide-zinc-100 dark:divide-zinc-700/60">
              {sec.segments.map((seg, j) => (
                <div key={j} className="px-3 py-2 flex gap-2 items-start">
                  {seg.speaker_label && (
                    <span className="text-xs font-semibold text-blue-500 dark:text-blue-400 shrink-0 mt-0.5 uppercase tracking-wide">
                      {seg.speaker_label}
                    </span>
                  )}
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed line-clamp-3">{seg.script_text}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function ScriptPrepDialog({ projectId, projectKind = 'audiobook', onClose, onApplied }: ScriptPrepDialogProps) {
  const [rawScript, setRawScript] = useState('');
  const [detectSpeakers, setDetectSpeakers] = useState(true);
  const [suggestPronunciations, setSuggestPronunciations] = useState(true);
  const [suggestStyles, setSuggestStyles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [job, setJob] = useState<ScriptPrepJob | null>(null);
  const [result, setResult] = useState<ScriptPrepResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyCastProfiles, setApplyCastProfiles] = useState(true);
  const [applyPronunciations, setApplyPronunciations] = useState(true);
  const [applying, setApplying] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLTextAreaElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    firstFocusRef.current?.focus();
    return () => { isMountedRef.current = false; };
  }, []);

  // Escape-to-close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== 'Tab') return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button,textarea,input,select,[tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }, []);

  const handlePrepare = useCallback(async () => {
    if (!rawScript.trim()) return;
    setLoading(true);
    setError(null);
    setJob(null);
    setResult(null);
    try {
      const opts: ScriptPrepOptions = {
        project_kind: projectKind,
        detect_speakers: detectSpeakers,
        suggest_pronunciations: suggestPronunciations,
        suggest_styles: suggestStyles,
        max_segment_length: 500,
      };
      const j = await prepareScript(projectId, rawScript, opts);
      if (!isMountedRef.current) return;
      setJob(j);
      const parsed = parseResult(j);
      setResult(parsed);
      if (j.status === 'failed') setError(j.error ?? 'Script preparation failed.');
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Script preparation failed.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [projectId, projectKind, rawScript, detectSpeakers, suggestPronunciations, suggestStyles]);

  const handleApply = useCallback(async () => {
    if (!result) return;
    setApplying(true);
    setError(null);
    try {
      const summary = await applyScriptPrep(projectId, {
        job_id: job?.id,
        result: job?.id ? undefined : result,
        create_cast_profiles: applyCastProfiles,
        create_pronunciation_entries: applyPronunciations,
      });
      if (!isMountedRef.current) return;
      onApplied?.(summary);
      onClose();
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to apply script prep.');
    } finally {
      if (isMountedRef.current) setApplying(false);
    }
  }, [projectId, job, result, applyCastProfiles, applyPronunciations, onApplied, onClose]);

  const totalSegments = result?.sections.reduce((n, s) => n + s.segments.length, 0) ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      aria-modal="true"
      role="dialog"
      aria-labelledby="script-prep-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        className="relative bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-zinc-200 dark:border-zinc-700 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="script-prep-title" className="font-semibold text-zinc-900 dark:text-zinc-100">AI Script Prep</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">Analyse your manuscript and generate a production-ready structure</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Textarea */}
          <div>
            <label htmlFor="raw-script" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
              Paste your raw script
            </label>
            <textarea
              id="raw-script"
              ref={firstFocusRef}
              value={rawScript}
              onChange={e => setRawScript(e.target.value)}
              rows={10}
              placeholder="Paste your manuscript or script here. The AI will split it into sections and segments, detect speakers, and suggest pronunciation guides…"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-600 bg-zinc-50 dark:bg-zinc-800 text-sm text-zinc-800 dark:text-zinc-200 px-4 py-3 resize-y focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder-zinc-400 dark:placeholder-zinc-500"
            />
            <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">{rawScript.length.toLocaleString()} characters</p>
          </div>

          {/* Options */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {([
              { id: 'detect-speakers', label: 'Detect Speakers', value: detectSpeakers, onChange: setDetectSpeakers },
              { id: 'suggest-pron', label: 'Pronunciation Hints', value: suggestPronunciations, onChange: setSuggestPronunciations },
              { id: 'suggest-styles', label: 'Style Suggestions', value: suggestStyles, onChange: setSuggestStyles },
            ] as const).map(opt => (
              <label
                key={opt.id}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition-colors select-none"
              >
                <input
                  type="checkbox"
                  id={opt.id}
                  checked={opt.value}
                  onChange={e => (opt.onChange as (v: boolean) => void)(e.target.checked)}
                  className="w-4 h-4 accent-purple-500"
                />
                <span className="text-sm text-zinc-700 dark:text-zinc-300">{opt.label}</span>
              </label>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-3">
              <AlertTriangle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Results */}
          {result && (
            <div className="space-y-4">
              {/* Summary badges */}
              <div className="flex flex-wrap gap-2">
                <span className="px-3 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-medium">
                  <BookOpen className="w-3 h-3 inline mr-1" />
                  {result.sections.length} section{result.sections.length !== 1 ? 's' : ''}
                </span>
                <span className="px-3 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium">
                  {totalSegments} segment{totalSegments !== 1 ? 's' : ''}
                </span>
                {result.speaker_candidates.length > 0 && (
                  <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-medium">
                    <Mic2 className="w-3 h-3 inline mr-1" />
                    {result.speaker_candidates.length} speaker{result.speaker_candidates.length !== 1 ? 's' : ''}
                  </span>
                )}
                {result.pronunciation_candidates.length > 0 && (
                  <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-xs font-medium">
                    {result.pronunciation_candidates.length} pronunciation hint{result.pronunciation_candidates.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>

              {/* Warnings */}
              {result.warnings.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 space-y-1">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Warnings</p>
                  {result.warnings.map((w, i) => <p key={i} className="text-xs text-amber-600 dark:text-amber-300 ml-5">{w}</p>)}
                </div>
              )}

              {/* Sections tree */}
              <div>
                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Proposed Structure</h3>
                <SectionTree sections={result.sections} />
              </div>

              {/* Speaker candidates */}
              {result.speaker_candidates.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Detected Speakers</h3>
                  <div className="space-y-2">
                    {result.speaker_candidates.map((sp, i) => (
                      <div key={i} className="rounded-xl border border-zinc-200 dark:border-zinc-700 px-3 py-2.5">
                        <div className="flex items-center gap-2 mb-1">
                          <Mic2 className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{sp.label}</span>
                          <span className="ml-auto text-xs text-zinc-400 dark:text-zinc-500">{sp.occurrences} line{sp.occurrences !== 1 ? 's' : ''}</span>
                        </div>
                        {sp.sample_lines.slice(0, 2).map((ln, j) => (
                          <p key={j} className="text-xs text-zinc-500 dark:text-zinc-400 italic ml-5 truncate">"{ln}"</p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Pronunciation candidates */}
              {result.pronunciation_candidates.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-500" /> Pronunciation Hints
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {result.pronunciation_candidates.map((p, i) => (
                      <div key={i} className="rounded-lg border border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5">
                        <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">{p.word}</span>
                        {p.phonetic && <span className="text-xs text-amber-600 dark:text-amber-400 ml-1.5">/{p.phonetic}/</span>}
                        {p.notes && <p className="text-xs text-amber-500 dark:text-amber-500 mt-0.5">{p.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Style suggestions */}
              {result.style_suggestions.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 mb-2">Style Suggestions</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.style_suggestions.map((s, i) => (
                      <span key={i} className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 text-xs">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-4 py-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Apply Options</p>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={applyCastProfiles}
                    onChange={e => setApplyCastProfiles(e.target.checked)}
                    className="h-4 w-4 accent-purple-500"
                  />
                  Create cast profiles from detected speakers
                </label>
                <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                  <input
                    type="checkbox"
                    checked={applyPronunciations}
                    onChange={e => setApplyPronunciations(e.target.checked)}
                    className="h-4 w-4 accent-purple-500"
                  />
                  Add pronunciation hints to an AI Script Prep dictionary
                </label>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 py-4 border-t border-zinc-200 dark:border-zinc-700 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-full text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          <div className="flex-1" />
          {result && (
            <button
              onClick={handleApply}
              disabled={applying}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
            >
              {applying && <Loader2 className="w-4 h-4 animate-spin" />}
              {applying ? 'Applying...' : 'Apply to Project'}
            </button>
          )}
          <button
            onClick={handlePrepare}
            disabled={loading || !rawScript.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
              : <><Sparkles className="w-4 h-4" /> {result ? 'Re-run' : 'Prepare Script'}</>}
          </button>
        </div>
      </div>
    </div>
  );
}
