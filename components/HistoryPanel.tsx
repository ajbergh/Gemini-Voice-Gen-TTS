/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * HistoryPanel.tsx — Generation History Browser
 *
 * Slide-in panel displaying all past TTS generations and AI recommendations.
 * Entries are fetched from /api/history with pagination and type filtering.
 * TTS entries with cached audio can be replayed directly — audio is fetched
 * as base64 PCM from /api/history/:id/audio and decoded via Web Audio API
 * at 24kHz sample rate. Supports entry deletion, bulk clear, and expandable
 * detail views. Implements focus trap and Escape-to-close.
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, Sparkles, Volume2, Trash2, Loader2, ChevronDown, Play, Square } from 'lucide-react';
import { getHistory, deleteHistoryEntry, clearHistory, getHistoryAudio, HistoryEntry } from '../api';

interface HistoryPanelProps {
  onClose: () => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({ onClose }) => {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'tts' | 'recommendation'>('all');
  const [clearing, setClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadHistory();
    return () => {
      isMountedRef.current = false;
      stopAudio();
    };
  }, [filter]);

  // Focus trap
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll(
        'button, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === first) { last.focus(); e.preventDefault(); }
      } else {
        if (document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  /** Fetch history entries from the backend, filtered by current type selection. */
  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const type = filter === 'all' ? undefined : filter;
      const data = await getHistory(type, 100, 0);
      if (isMountedRef.current) setEntries(data || []);
    } catch {
      if (isMountedRef.current) setError('Failed to load history.');
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  /** Delete a single history entry and remove it from local state. */
  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deleteHistoryEntry(id);
      if (isMountedRef.current) {
        setEntries(prev => prev.filter(e => e.id !== id));
        if (expandedId === id) setExpandedId(null);
      }
    } catch {
      if (isMountedRef.current) setError('Failed to delete entry.');
    } finally {
      if (isMountedRef.current) setDeletingId(null);
    }
  };

  /** Clear all history entries from the backend and reset local state. */
  const handleClear = async () => {
    setClearing(true);
    try {
      await clearHistory();
      if (isMountedRef.current) {
        setEntries([]);
        setExpandedId(null);
      }
    } catch {
      if (isMountedRef.current) setError('Failed to clear history.');
    } finally {
      if (isMountedRef.current) setClearing(false);
    }
  };

  /** Stop any currently playing cached audio and reset playback state. */
  const stopAudio = () => {
    if (audioSourceRef.current) {
      try { audioSourceRef.current.stop(); } catch {}
      audioSourceRef.current = null;
    }
    setPlayingId(null);
  };

  /**
   * Play/stop cached audio for a history entry. Fetches base64 PCM from
   * the backend, decodes to 16-bit samples, and plays via Web Audio API at 24kHz.
   */
  const handlePlayAudio = async (entryId: number) => {
    if (playingId === entryId) {
      stopAudio();
      return;
    }
    stopAudio();
    setLoadingAudioId(entryId);
    try {
      const base64 = await getHistoryAudio(entryId);
      if (!isMountedRef.current) return;

      // Decode base64 to raw PCM bytes
      const binaryStr = atob(base64);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      // Create audio context at 24kHz (Gemini TTS output rate)
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      const ctx = audioContextRef.current;

      // Convert 16-bit PCM to float32
      const pcm16 = new Int16Array(bytes.buffer);
      const audioBuffer = ctx.createBuffer(1, pcm16.length, 24000);
      const channelData = audioBuffer.getChannelData(0);
      for (let i = 0; i < pcm16.length; i++) channelData[i] = pcm16[i] / 32768;

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => { if (isMountedRef.current) setPlayingId(null); };
      source.start();
      audioSourceRef.current = source;
      if (isMountedRef.current) setPlayingId(entryId);
    } catch {
      if (isMountedRef.current) setError('Failed to play cached audio.');
    } finally {
      if (isMountedRef.current) setLoadingAudioId(null);
    }
  };

  /** Format a date string as a human-readable relative time (e.g., "5m ago", "2d ago"). */
  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString();
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>

      {/* Modal */}
      <div ref={modalRef} className="relative w-full max-w-2xl max-h-[85vh] bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden animate-slide-up ring-1 ring-zinc-900/5 flex flex-col">
        {/* Header */}
        <div className="relative p-8 pb-4 flex-shrink-0">
          <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-violet-50/50 to-white/0 dark:from-violet-900/20 dark:to-zinc-900/0 pointer-events-none"></div>

          <div className="relative flex justify-between items-start mb-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 mb-1">
                <Clock size={18} />
                <span className="text-sm font-bold tracking-wider uppercase">History</span>
              </div>
              <h2 id="history-title" className="text-2xl font-serif font-medium tracking-tight text-zinc-900 dark:text-white">Generation History</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Filter tabs + Clear */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl p-1">
              {(['all', 'recommendation', 'tts'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setFilter(t)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === t ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
                >
                  {t === 'all' ? 'All' : t === 'recommendation' ? 'Recommendations' : 'TTS'}
                </button>
              ))}
            </div>
            {entries.length > 0 && (
              <button
                onClick={handleClear}
                disabled={clearing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                {clearing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Clear All
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-zinc-400" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-16">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 mb-4">
                <Clock size={24} className="text-zinc-400" />
              </div>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm">No history entries yet.</p>
              <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">Recommendations and TTS generations will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {entries.map(entry => {
                const isExpanded = expandedId === entry.id;

                return (
                  <div
                    key={entry.id}
                    className="group bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden transition-colors hover:border-zinc-200 dark:hover:border-zinc-700"
                  >
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                      className="w-full flex items-center gap-3 p-4 text-left"
                      aria-expanded={isExpanded}
                    >
                      <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${entry.type === 'tts' ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-violet-100 dark:bg-violet-900/30'}`}>
                        {entry.type === 'tts' ? (
                          <Volume2 size={14} className="text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Sparkles size={14} className="text-violet-600 dark:text-violet-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">
                            {entry.input_text?.substring(0, 60) || (entry.type === 'tts' ? 'TTS Generation' : 'Recommendation')}
                            {entry.input_text && entry.input_text.length > 60 && '...'}
                          </span>
                          {entry.voice_name && (
                            <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
                              {entry.voice_name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">{formatDate(entry.created_at)}</p>
                      </div>
                      <ChevronDown size={16} className={`flex-shrink-0 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-zinc-100 dark:border-zinc-800">
                        <div className="pt-3 space-y-2">
                          {entry.input_text && (
                            <div>
                              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">{entry.type === 'tts' ? 'Script' : 'Query'}</p>
                              <p className="text-sm text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 p-3 rounded-xl">{entry.input_text}</p>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-2">
                            {entry.type === 'tts' && entry.audio_path && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handlePlayAudio(entry.id); }}
                                disabled={loadingAudioId === entry.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              >
                                {loadingAudioId === entry.id ? (
                                  <Loader2 size={12} className="animate-spin" />
                                ) : playingId === entry.id ? (
                                  <Square size={12} />
                                ) : (
                                  <Play size={12} />
                                )}
                                {playingId === entry.id ? 'Stop' : 'Play'}
                              </button>
                            )}
                            {!(entry.type === 'tts' && entry.audio_path) && <div />}
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                              disabled={deletingId === entry.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            >
                              {deletingId === entry.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default HistoryPanel;
