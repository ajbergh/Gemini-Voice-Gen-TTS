/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SegmentTakeList.tsx — Expand/collapse list of audio takes for one segment.
 *
 * Features:
 * - Lists existing takes with take number, voice, status badge, duration, and
 *   creation timestamp.
 * - Play button for each take (decodes cached PCM audio if available via the
 *   history audio endpoint, or uses a raw audio path).
 * - Delete take button (confirm on second click).
 * - Reviewer notes: expand notes per take, add/delete notes inline.
 * - "Add take" entry: pre-fills from the parent segment's voice + speaker
 *   metadata so users can quickly re-render with a manual record path.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  ChevronRight,
  Loader2,
  MessageSquare,
  Mic,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  createSegmentTake,
  createTakeNote,
  deleteTakeNote,
  deleteSegmentTake,
  getTakeAudio,
  listSegmentTakes,
  listTakeNotes,
} from '../api';
import { ScriptSegment, SegmentTake, TakeNote } from '../types';
import { useToast } from './ToastProvider';
import WaveformCanvas from './WaveformCanvas';
import { decodePcmBase64ToFloat32 } from '../audio/pcm';

interface SegmentTakeListProps {
  projectId: number;
  segment: ScriptSegment;
  /** Called after any mutation so the parent can update segment status. */
  onTakesChanged?: () => void;
}

const TAKE_STATUS_BADGE: Record<string, string> = {
  rendered:  'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  approved:  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  flagged:   'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  rejected:  'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  draft:     'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
};

/** Return badge color classes for a take status. */
function takeBadge(status: string): string {
  return TAKE_STATUS_BADGE[status] ?? TAKE_STATUS_BADGE.draft;
}

/** Format a take duration in seconds for display. */
function formatDuration(secs?: number): string {
  if (secs === undefined || secs === null) return '—';
  const m = Math.floor(secs / 60);
  const s = (secs % 60).toFixed(1);
  return m > 0 ? `${m}:${s.padStart(4, '0')}` : `${s}s`;
}

/** Format a stored timestamp for the take list. */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------

const SegmentTakeList: React.FC<SegmentTakeListProps> = ({
  projectId,
  segment,
  onTakesChanged,
}) => {
  const { showToast } = useToast();
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const [expanded, setExpanded] = useState(false);
  const [takes, setTakes] = useState<SegmentTake[]>([]);
  const [loading, setLoading] = useState(false);

  // Waveform samples keyed by take id ('loading' = fetch in-progress, null = no audio)
  const [waveforms, setWaveforms] = useState<Record<number, Float32Array | 'loading' | null>>({});

  // -- notes state keyed by take id --
  const [expandedNotesId, setExpandedNotesId] = useState<number | null>(null);
  const [notesByTake, setNotesByTake] = useState<Record<number, TakeNote[]>>({});
  const [loadingNotesId, setLoadingNotesId] = useState<number | null>(null);
  const [newNoteText, setNewNoteText] = useState('');
  const [savingNoteId, setSavingNoteId] = useState<number | null>(null);

  // -- delete confirm --
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // -- add take form --
  const [showAddTake, setShowAddTake] = useState(false);
  const [addTakeVoice, setAddTakeVoice] = useState('');
  const [addTakeStatus, setAddTakeStatus] = useState('rendered');
  const [addTakeDuration, setAddTakeDuration] = useState('');
  const [savingTake, setSavingTake] = useState(false);

  // ---------------------------------------------------------------------------

  const loadTakes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSegmentTakes(projectId, segment.id);
      if (!isMounted.current) return;
      setTakes(data);
      // Pre-fetch waveforms for takes that have cached audio
      data.forEach(take => {
        if (!take.audio_path) return;
        setWaveforms(prev => ({ ...prev, [take.id]: 'loading' }));
        getTakeAudio(projectId, segment.id, take.id)
          .then(b64 => {
            if (!isMounted.current) return;
            try {
              const samples = decodePcmBase64ToFloat32(b64);
              setWaveforms(prev => ({ ...prev, [take.id]: samples }));
            } catch {
              setWaveforms(prev => ({ ...prev, [take.id]: null }));
            }
          })
          .catch(() => {
            if (isMounted.current) {
              setWaveforms(prev => ({ ...prev, [take.id]: null }));
            }
          });
      });
    } catch (err: any) {
      if (!isMounted.current) return;
      showToast(err?.message ?? 'Failed to load takes.', 'error');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, [projectId, segment.id, showToast]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && takes.length === 0) loadTakes();
  };

  const handleDeleteTake = async (takeId: number) => {
    if (confirmDeleteId !== takeId) {
      setConfirmDeleteId(takeId);
      return;
    }
    setConfirmDeleteId(null);
    try {
      await deleteSegmentTake(projectId, segment.id, takeId);
      setTakes(prev => prev.filter(t => t.id !== takeId));
      onTakesChanged?.();
      showToast('Take deleted', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to delete take.', 'error');
    }
  };

  const handleAddTake = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTake(true);
    try {
      const dur = parseFloat(addTakeDuration);
      const take = await createSegmentTake(projectId, segment.id, {
        script_text: segment.script_text,
        voice_name: addTakeVoice.trim() || segment.voice_name || undefined,
        speaker_label: segment.speaker_label || undefined,
        status: addTakeStatus,
        duration_seconds: !isNaN(dur) ? dur : undefined,
      });
      if (!isMounted.current) return;
      setTakes(prev => [take, ...prev]);
      setShowAddTake(false);
      setAddTakeVoice('');
      setAddTakeDuration('');
      setAddTakeStatus('rendered');
      onTakesChanged?.();
      showToast('Take recorded', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to record take.', 'error');
    } finally {
      if (isMounted.current) setSavingTake(false);
    }
  };

  const handleToggleNotes = async (takeId: number) => {
    if (expandedNotesId === takeId) {
      setExpandedNotesId(null);
      return;
    }
    setExpandedNotesId(takeId);
    if (notesByTake[takeId]) return;
    setLoadingNotesId(takeId);
    try {
      const notes = await listTakeNotes(projectId, segment.id, takeId);
      if (!isMounted.current) return;
      setNotesByTake(prev => ({ ...prev, [takeId]: notes }));
    } catch {
      // Non-critical
    } finally {
      if (isMounted.current) setLoadingNotesId(null);
    }
  };

  const handleAddNote = async (takeId: number) => {
    const text = newNoteText.trim();
    if (!text) return;
    setSavingNoteId(takeId);
    try {
      await createTakeNote(projectId, segment.id, takeId, text);
      const notes = await listTakeNotes(projectId, segment.id, takeId);
      if (!isMounted.current) return;
      setNotesByTake(prev => ({ ...prev, [takeId]: notes }));
      setNewNoteText('');
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to add note.', 'error');
    } finally {
      if (isMounted.current) setSavingNoteId(null);
    }
  };

  const handleDeleteNote = async (takeId: number, noteId: number) => {
    try {
      await deleteTakeNote(projectId, segment.id, takeId, noteId);
      setNotesByTake(prev => ({
        ...prev,
        [takeId]: (prev[takeId] ?? []).filter(n => n.id !== noteId),
      }));
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to delete note.', 'error');
    }
  };

  // ---------------------------------------------------------------------------

  const takesCount = expanded ? takes.length : null;

  return (
    <div className="mt-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40">
      {/* Header row */}
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        {expanded
          ? <ChevronDown size={12} className="shrink-0 text-zinc-400" />
          : <ChevronRight size={12} className="shrink-0 text-zinc-400" />}
        <Mic size={12} className="shrink-0 text-zinc-400" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Takes
          {expanded && !loading && (
            <span className="ml-1.5 font-normal normal-case">({takes.length})</span>
          )}
        </span>
        {loading && <Loader2 size={11} className="animate-spin text-zinc-400" />}
      </button>

      {/* Body */}
      {expanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 pb-3 pt-2 space-y-2">
          {takes.length === 0 && !loading ? (
            <p className="text-[11px] italic text-zinc-400 dark:text-zinc-500">No takes yet.</p>
          ) : (
            takes.map(take => (
              <div
                key={take.id}
                className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950"
              >
                {/* Take header */}
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="shrink-0 text-xs font-bold text-zinc-500 dark:text-zinc-400 w-8">
                    T{take.take_number}
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    {take.voice_name && (
                      <p className="truncate text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">
                        {take.voice_name}
                        {take.speaker_label && (
                          <span className="ml-1.5 font-normal text-zinc-400 dark:text-zinc-500">
                            — {take.speaker_label}
                          </span>
                        )}
                      </p>
                    )}
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500">
                      {formatDate(take.created_at)}
                      {take.duration_seconds !== undefined && take.duration_seconds !== null && (
                        <span className="ml-2">{formatDuration(take.duration_seconds)}</span>
                      )}
                    </p>
                    {(take.provider || take.model || take.provider_voice || take.language_code || take.style_id || take.prompt_hash) && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {take.provider && (
                          <span className="rounded bg-sky-50 dark:bg-sky-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 dark:text-sky-300">
                            {take.provider}{take.model ? ` / ${take.model}` : ''}
                          </span>
                        )}
                        {take.provider_voice && take.provider_voice !== take.voice_name && (
                          <span className="rounded bg-violet-50 dark:bg-violet-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-violet-700 dark:text-violet-300">
                            provider voice {take.provider_voice}
                          </span>
                        )}
                        {take.language_code && (
                          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500 dark:text-zinc-400">
                            {take.language_code}
                          </span>
                        )}
                        {take.style_id && (
                          <span className="rounded bg-emerald-50 dark:bg-emerald-900/30 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 dark:text-emerald-300">
                            style #{take.style_id}
                          </span>
                        )}
                        {take.prompt_hash && (
                          <span title={`Prompt hash ${take.prompt_hash}`} className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500 dark:text-zinc-400">
                            prompt {take.prompt_hash.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${takeBadge(take.status)}`}>
                    {take.status}
                  </span>
                  {take.clipping_detected && (
                    <span
                      title="Clipping detected"
                      className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300"
                    >
                      <AlertTriangle size={9} />
                    </span>
                  )}
                  {/* Notes toggle */}
                  <button
                    type="button"
                    title="Reviewer notes"
                    onClick={() => handleToggleNotes(take.id)}
                    className={`shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                      expandedNotesId === take.id
                        ? 'text-[var(--accent-600)] dark:text-[var(--accent-300)]'
                        : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200'
                    }`}
                  >
                    <MessageSquare size={12} />
                  </button>
                  {/* Delete */}
                  <button
                    type="button"
                    title={confirmDeleteId === take.id ? 'Click again to confirm' : 'Delete take'}
                    onClick={() => handleDeleteTake(take.id)}
                    className={`shrink-0 inline-flex h-6 w-6 items-center justify-center rounded-md transition-colors ${
                      confirmDeleteId === take.id
                        ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                        : 'text-zinc-400 hover:text-red-500'
                    }`}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>

                {/* Waveform row */}
                {take.audio_path && (
                  <div className="px-3 pb-2">
                    {waveforms[take.id] === 'loading' ? (
                      <div className="flex h-10 items-center gap-1.5 text-[10px] text-zinc-400">
                        <Loader2 size={10} className="animate-spin" />
                        Loading waveform…
                      </div>
                    ) : (
                      <WaveformCanvas
                        samples={waveforms[take.id] instanceof Float32Array
                          ? waveforms[take.id] as Float32Array
                          : null}
                        height={40}
                        compact
                      />
                    )}
                  </div>
                )}

                {/* Notes panel */}
                {expandedNotesId === take.id && (
                  <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 pb-2 pt-2 space-y-1.5">
                    {loadingNotesId === take.id ? (
                      <Loader2 size={12} className="animate-spin text-zinc-400" />
                    ) : (
                      <>
                        {(notesByTake[take.id] ?? []).map(note => (
                          <div key={note.id} className="flex items-start gap-2">
                            <p className="min-w-0 flex-1 text-[11px] text-zinc-600 dark:text-zinc-300">{note.note}</p>
                            <button
                              type="button"
                              onClick={() => handleDeleteNote(take.id, note.id)}
                              className="shrink-0 inline-flex h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-red-500 transition-colors"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ))}
                        <div className="flex gap-1.5 pt-0.5">
                          <input
                            value={expandedNotesId === take.id ? newNoteText : ''}
                            onChange={e => setNewNoteText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddNote(take.id); } }}
                            placeholder="Add note…"
                            className="h-7 min-w-0 flex-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent-100)]"
                          />
                          <button
                            type="button"
                            disabled={savingNoteId === take.id || !newNoteText.trim()}
                            onClick={() => handleAddNote(take.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-900 dark:bg-[var(--accent-600)] text-white hover:bg-zinc-700 transition-colors disabled:opacity-50"
                          >
                            {savingNoteId === take.id ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Add take form */}
          {showAddTake ? (
            <form onSubmit={handleAddTake} className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Record take
              </p>
              <div className="flex flex-wrap gap-2">
                <input
                  value={addTakeVoice}
                  onChange={e => setAddTakeVoice(e.target.value)}
                  placeholder={`Voice (default: ${segment.voice_name || 'none'})`}
                  className="h-8 min-w-0 flex-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent-100)]"
                />
                <input
                  value={addTakeDuration}
                  onChange={e => setAddTakeDuration(e.target.value)}
                  placeholder="Duration (s)"
                  type="number"
                  min="0"
                  step="0.1"
                  className="h-8 w-28 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-[var(--accent-100)]"
                />
                <select
                  value={addTakeStatus}
                  onChange={e => setAddTakeStatus(e.target.value)}
                  className="h-8 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2 text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-[var(--accent-100)]"
                >
                  <option value="rendered">rendered</option>
                  <option value="approved">approved</option>
                  <option value="flagged">flagged</option>
                  <option value="draft">draft</option>
                </select>
              </div>
              <div className="flex justify-end gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAddTake(false)}
                  className="inline-flex h-7 items-center gap-1 rounded border border-zinc-200 dark:border-zinc-800 px-2.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <X size={10} /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTake}
                  className="inline-flex h-7 items-center gap-1 rounded bg-zinc-900 dark:bg-[var(--accent-600)] px-2.5 text-[11px] font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
                >
                  {savingTake ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />}
                  Save take
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddTake(true)}
              className="flex w-full items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-[11px] font-semibold text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <Plus size={11} /> Record take
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SegmentTakeList;
