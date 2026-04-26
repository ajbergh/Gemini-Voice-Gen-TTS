/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TimelineReview — Per-segment waveform timeline with playback, seek,
 * export profile selection, and stitch-to-WAV download.
 *
 * Renders a scrollable list of segment rows. Each row shows the segment's
 * waveform (lazily loaded), play/status controls, and clipping warnings.
 * Clicking a waveform seeks within the active take. The export toolbar
 * at the top lets the user pick a finishing profile and stitch the project
 * into a single WAV file.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Download,
  Loader2,
  Pause,
  Play,
} from 'lucide-react';
import {
  getTakeAudio,
  listSegmentTakes,
  stitchProject,
  StitchOptions,
} from '../api';
import { decodePcmBase64ToFloat32 } from '../audio/pcm';
import {
  ScriptSection,
  ScriptSegment,
  SegmentTake,
} from '../types';
import { useAudio } from './AudioProvider';
import ExportProfilePicker from './ExportProfilePicker';
import WaveformCanvas from './WaveformCanvas';
import { useToast } from './ToastProvider';

interface TimelineReviewProps {
  projectId: number;
  sections: ScriptSection[];
  segments: ScriptSegment[];
}

const STATUS_COLORS: Record<string, string> = {
  approved: 'text-emerald-600 dark:text-emerald-400',
  rendered: 'text-blue-600 dark:text-blue-400',
  rendering: 'text-yellow-600 dark:text-yellow-400',
  flagged: 'text-red-600 dark:text-red-400',
  locked: 'text-violet-600 dark:text-violet-400',
  draft: 'text-zinc-400 dark:text-zinc-500',
  changed: 'text-amber-600 dark:text-amber-400',
};

export default function TimelineReview({ projectId, sections, segments }: TimelineReviewProps) {
  const { playPcm, stop, isPlaying, currentTrack, progress } = useAudio();
  const { showToast } = useToast();

  // Per-segment best takes (loaded lazily).
  const [bestTakes, setBestTakes] = useState<Record<number, SegmentTake | null>>({});
  // Per-segment waveform samples.
  const [waveforms, setWaveforms] = useState<Record<number, Float32Array | 'loading' | null>>({});
  // Which segment rows are collapsed.
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  // Export profile picker state.
  const [profileId, setProfileId] = useState<number | null>(null);
  const [stitching, setStitching] = useState(false);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Load best take + waveform for every segment on mount.
  useEffect(() => {
    for (const seg of segments) {
      if (seg.id in bestTakes) continue; // already loaded or loading

      // Mark as loading
      setBestTakes(prev => ({ ...prev, [seg.id]: undefined as any }));

      listSegmentTakes(projectId, seg.id)
        .then(takes => {
          if (!isMountedRef.current) return;
          // Pick approved > rendered > any with audio_path
          const ranked = [...takes].sort((a, b) => {
            const priority = (s: string) => s === 'approved' ? 0 : s === 'rendered' ? 1 : 2;
            return priority(a.status) - priority(b.status) || b.take_number - a.take_number;
          });
          const best = ranked.find(t => t.audio_path) ?? null;
          setBestTakes(prev => ({ ...prev, [seg.id]: best }));

          if (best?.audio_path) {
            setWaveforms(prev => ({ ...prev, [seg.id]: 'loading' }));
            getTakeAudio(projectId, seg.id, best.id)
              .then(b64 => {
                if (!isMountedRef.current) return;
                const samples = decodePcmBase64ToFloat32(b64);
                setWaveforms(prev => ({ ...prev, [seg.id]: samples }));
              })
              .catch(() => {
                if (!isMountedRef.current) return;
                setWaveforms(prev => ({ ...prev, [seg.id]: null }));
              });
          } else {
            setWaveforms(prev => ({ ...prev, [seg.id]: null }));
          }
        })
        .catch(() => {
          if (!isMountedRef.current) return;
          setBestTakes(prev => ({ ...prev, [seg.id]: null }));
          setWaveforms(prev => ({ ...prev, [seg.id]: null }));
        });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segments, projectId]);

  const handlePlay = useCallback(async (seg: ScriptSegment) => {
    const take = bestTakes[seg.id];
    if (!take?.audio_path) return;

    const trackLabel = `${seg.title || `Segment ${seg.id}`}`;
    const isThisPlaying =
      isPlaying && currentTrack?.label === trackLabel;

    if (isThisPlaying) {
      stop();
      return;
    }

    try {
      const b64 = await getTakeAudio(projectId, seg.id, take.id);
      await playPcm(b64, {
        label: trackLabel,
        subtitle: seg.script_text.slice(0, 80),
        source: 'tts',
      });
    } catch {
      showToast('Failed to play audio.', 'error');
    }
  }, [bestTakes, isPlaying, currentTrack, stop, playPcm, projectId, showToast]);

  const handleSeek = useCallback((_segId: number, _pos: number) => {
    // Seeking within a buffered take is not yet implemented;
    // the click still provides a visual affordance.
  }, []);

  const handleStitch = useCallback(async () => {
    setStitching(true);
    try {
      const opts: StitchOptions = {};
      if (profileId != null) opts.export_profile_id = profileId;
      const blob = await stitchProject(projectId, opts);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `project-${projectId}-export.wav`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showToast('WAV export downloaded.', 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Export failed.', 'error');
    } finally {
      setStitching(false);
    }
  }, [projectId, profileId, showToast]);

  const toggleCollapse = useCallback((segId: number) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(segId)) {
        next.delete(segId);
      } else {
        next.add(segId);
      }
      return next;
    });
  }, []);

  // Group segments by section_id for display.
  const sectionMap = new Map(sections.map(s => [s.id, s]));
  const grouped: { section: ScriptSection | null; segs: ScriptSegment[] }[] = [];
  const bySectionId: Record<string, ScriptSegment[]> = {};

  for (const seg of segments) {
    const key = seg.section_id != null ? String(seg.section_id) : '__none__';
    (bySectionId[key] ??= []).push(seg);
  }

  if (bySectionId['__none__']?.length) {
    grouped.push({ section: null, segs: bySectionId['__none__'] });
  }
  for (const sec of sections) {
    const segs = bySectionId[String(sec.id)] ?? [];
    if (segs.length) grouped.push({ section: sec, segs });
  }

  const renderedCount = Object.values(bestTakes).filter(t => t?.audio_path).length;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Export toolbar */}
      <div className="flex items-center gap-3 flex-wrap px-4 py-3 bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
        <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">
          Timeline Review
        </span>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          {renderedCount} of {segments.length} segment{segments.length !== 1 ? 's' : ''} with audio
        </span>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <ExportProfilePicker
            value={profileId}
            onChange={(id) => setProfileId(id)}
            disabled={stitching}
          />
          <button
            type="button"
            disabled={stitching || renderedCount === 0}
            onClick={handleStitch}
            className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-4 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
          >
            {stitching
              ? <Loader2 size={13} className="animate-spin" />
              : <Download size={13} />
            }
            Stitch & Export WAV
          </button>
        </div>
      </div>

      {/* Segment rows */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {grouped.length === 0 && (
          <p className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No segments in this project.
          </p>
        )}
        {grouped.map(({ section, segs }) => (
          <div key={section?.id ?? '__none__'}>
            {section && (
              <div className="px-4 py-2 bg-zinc-50/80 dark:bg-zinc-900/30">
                <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
                  {section.title}
                </span>
              </div>
            )}
            {segs.map(seg => {
              const take = bestTakes[seg.id];
              const wfState = waveforms[seg.id];
              const samples = wfState instanceof Float32Array ? wfState : null;
              const wfLoading = wfState === 'loading';
              const isCollapsed = collapsed.has(seg.id);
              const trackLabel = `${seg.title || `Segment ${seg.id}`}`;
              const isThisPlaying = isPlaying && currentTrack?.label === trackLabel;
              const hasTakeAudio = take?.audio_path != null;

              return (
                <div key={seg.id} className="group">
                  {/* Segment header row */}
                  <div className="flex items-center gap-2 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors">
                    {/* Collapse toggle */}
                    <button
                      type="button"
                      onClick={() => toggleCollapse(seg.id)}
                      className="shrink-0 text-zinc-300 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                      aria-label={isCollapsed ? 'Expand waveform' : 'Collapse waveform'}
                    >
                      {isCollapsed
                        ? <ChevronRight size={14} />
                        : <ChevronDown size={14} />
                      }
                    </button>

                    {/* Play / pause */}
                    <button
                      type="button"
                      onClick={() => handlePlay(seg)}
                      disabled={!hasTakeAudio}
                      className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-[var(--accent-400)] hover:text-[var(--accent-600)] dark:hover:text-[var(--accent-300)] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label={isThisPlaying ? 'Pause' : 'Play'}
                    >
                      {isThisPlaying
                        ? <Pause size={12} />
                        : <Play size={12} />
                      }
                    </button>

                    {/* Segment info */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-200 truncate max-w-[200px]">
                          {seg.title || `Segment ${seg.id}`}
                        </span>
                        {seg.speaker_label && (
                          <span className="shrink-0 rounded-full bg-[var(--accent-100)] dark:bg-[var(--accent-900)] px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-700)] dark:text-[var(--accent-200)]">
                            {seg.speaker_label}
                          </span>
                        )}
                        <span className={`shrink-0 text-[10px] font-semibold capitalize ${STATUS_COLORS[seg.status] ?? 'text-zinc-400'}`}>
                          {seg.status}
                        </span>
                        {take?.clipping_detected && (
                          <span className="shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle size={10} />
                            Clipping
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-zinc-400 dark:text-zinc-500 truncate max-w-[360px]">
                        {seg.script_text.slice(0, 120)}
                      </p>
                    </div>

                    {/* Duration */}
                    {take?.duration_seconds != null && (
                      <span className="shrink-0 text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                        {formatDuration(take.duration_seconds)}
                      </span>
                    )}
                  </div>

                  {/* Waveform row */}
                  {!isCollapsed && (
                    <div className="px-10 pb-3">
                      {wfLoading ? (
                        <div className="flex items-center justify-center h-10 text-xs text-zinc-400 gap-2">
                          <Loader2 size={12} className="animate-spin" />
                          Loading waveform…
                        </div>
                      ) : (
                        <WaveformCanvas
                          samples={samples}
                          height={40}
                          compact={false}
                          playbackPosition={isThisPlaying ? progress : undefined}
                          onSeek={hasTakeAudio ? (pos) => handleSeek(seg.id, pos) : undefined}
                          className="rounded-md overflow-hidden"
                        />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 10);
  return m > 0
    ? `${m}:${String(s).padStart(2, '0')}`
    : `${s}.${ms}s`;
}
