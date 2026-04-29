/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ReviewMode.tsx - Full-screen take review workspace.
 *
 * Loads project segments, best takes, and QC issues, then coordinates the
 * review queue, transport controls, approve/flag actions, and marker creation.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import {
  approveTake,
  createQcIssue,
  flagTake,
  getTakeAudio,
  listProjectQcIssues,
  listProjectSegments,
  listSegmentTakes,
} from '../api';
import type {
  QcIssue,
  ReviewFilter,
  ScriptProject,
  ScriptSegment,
  SegmentTake,
} from '../types';
import { useAudio } from './AudioProvider';
import ReviewQueue from './ReviewQueue';
import ReviewTransport from './ReviewTransport';
import QcIssueList from './QcIssueList';
import QcIssueDialog from './QcIssueDialog';

interface ReviewModeProps {
  project: ScriptProject;
  onClose?: () => void;
  isDarkMode?: boolean;
  /** When true, renders as an inline panel instead of a full-screen fixed overlay. */
  inline?: boolean;
}

/** Render the modal review workflow for approving, flagging, and annotating takes. */
export default function ReviewMode({ project, onClose, isDarkMode = false, inline = false }: ReviewModeProps) {
  const { playPcm, stop, isPlaying } = useAudio();

  // ── Data ────────────────────────────────────────────────────────────────────
  const [segments, setSegments] = useState<ScriptSegment[]>([]);
  /** Best-take map: segmentId → approved/latest take */
  const [takesMap, setTakesMap] = useState<Record<number, SegmentTake | undefined>>({});
  /** QC issues per segment */
  const [issuesMap, setIssuesMap] = useState<Record<number, QcIssue[]>>({});
  /** Open QC count per segment for badges */
  const [qcStatusMap, setQcStatusMap] = useState<Record<number, number>>({});

  // ── UI ──────────────────────────────────────────────────────────────────────
  const [selectedSegmentId, setSelectedSegmentId] = useState<number | null>(null);
  const [filter, setFilter] = useState<ReviewFilter>('all');
  const [showAddIssue, setShowAddIssue] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const isMountedRef = useRef(true);

  // ── Derived ─────────────────────────────────────────────────────────────────
  const selectedSegment = segments.find(s => s.id === selectedSegmentId) ?? null;
  const selectedTake = selectedSegmentId != null ? takesMap[selectedSegmentId] : undefined;
  const selectedIssues = selectedSegmentId != null ? (issuesMap[selectedSegmentId] ?? []) : [];
  const currentIndex = selectedSegmentId != null ? segments.findIndex(s => s.id === selectedSegmentId) : -1;

  // ── Load data ────────────────────────────────────────────────────────────────
  useEffect(() => {
    isMountedRef.current = true;
    const load = async () => {
      setLoadingData(true);
      try {
        const segs = await listProjectSegments(project.id);
        if (!isMountedRef.current) return;
        setSegments(segs);

        // Load best takes (latest) and QC issues in parallel
        const [allIssues, ...takesArrays] = await Promise.all([
          listProjectQcIssues(project.id),
          ...segs.map(s => listSegmentTakes(project.id, s.id).catch(() => [] as SegmentTake[])),
        ]);
        if (!isMountedRef.current) return;

        // Build takes map — prefer approved, else latest
        const newTakesMap: Record<number, SegmentTake | undefined> = {};
        segs.forEach((seg, idx) => {
          const takes = takesArrays[idx] as SegmentTake[];
          const approved = takes.find(t => t.status === 'approved');
          newTakesMap[seg.id] = approved ?? takes[takes.length - 1];
        });
        setTakesMap(newTakesMap);

        // Build issues map
        const newIssuesMap: Record<number, QcIssue[]> = {};
        const newQcStatusMap: Record<number, number> = {};
        for (const seg of segs) newIssuesMap[seg.id] = [];
        for (const issue of allIssues as QcIssue[]) {
          if (issue.segment_id != null) {
            if (!newIssuesMap[issue.segment_id]) newIssuesMap[issue.segment_id] = [];
            newIssuesMap[issue.segment_id].push(issue);
          }
        }
        for (const seg of segs) {
          newQcStatusMap[seg.id] = (newIssuesMap[seg.id] ?? []).filter(i => i.status === 'open').length;
        }
        setIssuesMap(newIssuesMap);
        setQcStatusMap(newQcStatusMap);

        if (segs.length > 0 && isMountedRef.current) {
          setSelectedSegmentId(segs[0].id);
        }
      } catch { /* ignore */ } finally {
        if (isMountedRef.current) setLoadingData(false);
      }
    };
    load();
    return () => { isMountedRef.current = false; };
  }, [project.id]);

  // ── Playback ─────────────────────────────────────────────────────────────────
  const playCurrentTake = useCallback(async () => {
    if (!selectedTake?.audio_path) return;
    try {
      const base64 = await getTakeAudio(selectedTake.project_id, selectedTake.segment_id, selectedTake.id);
      await playPcm(base64, {
        label: selectedSegment?.speaker_label ?? 'Take',
        source: 'history',
      });
    } catch { /* ignore playback errors */ }
  }, [selectedTake, selectedSegment, playPcm]);

  const handlePause = useCallback(() => stop(), [stop]);

  const navigateTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= segments.length) return;
    stop();
    setSelectedSegmentId(segments[idx].id);
  }, [segments, stop]);

  const handleNext = useCallback(() => navigateTo(currentIndex + 1), [navigateTo, currentIndex]);
  const handlePrev = useCallback(() => navigateTo(currentIndex - 1), [navigateTo, currentIndex]);
  const handleReplay = useCallback(() => { stop(); setTimeout(playCurrentTake, 50); }, [stop, playCurrentTake]);

  // ── Approve / Flag ───────────────────────────────────────────────────────────
  const handleApprove = useCallback(async () => {
    if (!selectedTake) return;
    try {
      const updated = await approveTake(project.id, selectedTake.id);
      setTakesMap(prev => ({ ...prev, [updated.segment_id]: updated }));
    } catch { /* ignore */ }
  }, [project.id, selectedTake]);

  const handleFlag = useCallback(async () => {
    if (!selectedTake) return;
    try {
      const updated = await flagTake(project.id, selectedTake.id);
      setTakesMap(prev => ({ ...prev, [updated.segment_id]: updated }));
    } catch { /* ignore */ }
  }, [project.id, selectedTake]);

  // ── QC issue saved ───────────────────────────────────────────────────────────
  const handleIssueSaved = useCallback((issue: QcIssue) => {
    setShowAddIssue(false);
    if (issue.segment_id == null) return;
    setIssuesMap(prev => {
      const list = [...(prev[issue.segment_id!] ?? [])];
      const idx = list.findIndex(i => i.id === issue.id);
      if (idx >= 0) list[idx] = issue; else list.push(issue);
      return { ...prev, [issue.segment_id!]: list };
    });
    setQcStatusMap(prev => {
      const segIssues = issuesMap[issue.segment_id!] ?? [];
      const merged = segIssues.find(i => i.id === issue.id) ? segIssues.map(i => i.id === issue.id ? issue : i) : [...segIssues, issue];
      return { ...prev, [issue.segment_id!]: merged.filter(i => i.status === 'open').length };
    });
  }, [issuesMap]);

  const handleIssuesChange = useCallback((segId: number, updated: QcIssue[]) => {
    setIssuesMap(prev => ({ ...prev, [segId]: updated }));
    setQcStatusMap(prev => ({ ...prev, [segId]: updated.filter(i => i.status === 'open').length }));
  }, []);

  // ── Approval keyboard hotkeys ────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't steal keys from editable fields
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if ((e.target as HTMLElement).isContentEditable) return;

      switch (e.key) {
        case ' ':
          e.preventDefault();
          isPlaying ? handlePause() : playCurrentTake();
          break;
        case 'a': case 'A': e.preventDefault(); handleApprove(); break;
        case 'f': case 'F': e.preventDefault(); handleFlag(); break;
        case 'r': case 'R': e.preventDefault(); handleReplay(); break;
        case 'n': case 'N': e.preventDefault(); handleNext(); break;
        case 'p': case 'P': e.preventDefault(); handlePrev(); break;
        case 'm': case 'M': e.preventDefault(); setShowAddIssue(true); break;
        case 'Escape':
          if (!inline && onClose) onClose();
          break;
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, handlePause, playCurrentTake, handleApprove, handleFlag, handleReplay, handleNext, handlePrev, inline, onClose]);

  // ── Layout ───────────────────────────────────────────────────────────────────
  const panelBg = isDarkMode ? 'bg-zinc-950 text-zinc-100' : 'bg-zinc-50 text-zinc-900';
  const ReviewContent: React.ElementType = inline ? 'div' : 'main';

  return (
    <div
      className={inline ? `flex flex-col min-h-0 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden ${panelBg}` : `fixed inset-0 z-40 flex flex-col ${panelBg}`}
      role={inline ? 'region' : 'dialog'}
      aria-modal={inline ? undefined : true}
      aria-label="Review Mode"
    >
      {/* Header */}
      <div className={`flex items-center justify-between px-6 py-3 border-b ${isDarkMode ? 'border-zinc-800 bg-zinc-900' : 'border-zinc-200 bg-white'}`}>
        <h2 className="font-semibold text-base">Review — {project.title}</h2>
        {!inline && onClose && (
          <button onClick={onClose} aria-label="Close review mode" className={`p-1.5 rounded-lg ${isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-100'}`}>
            <X size={18} />
          </button>
        )}
      </div>

      {loadingData ? (
        <div className="flex-1 flex items-center justify-center opacity-40 text-sm">Loading…</div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row gap-0">
          {/* Left panel — segment queue */}
          <aside className="h-56 sm:h-auto sm:w-64 shrink-0 flex flex-col border-b sm:border-b-0 sm:border-r overflow-hidden" style={{ borderColor: isDarkMode ? '#27272a' : '#e4e4e7' }}>
            <ReviewQueue
              segments={segments}
              takesMap={takesMap}
              qcStatusMap={qcStatusMap}
              filter={filter}
              onFilterChange={setFilter}
              onSelectSegment={setSelectedSegmentId}
              selectedSegmentId={selectedSegmentId}
              isDarkMode={isDarkMode}
            />
          </aside>

          {/* Center — main review area */}
          <ReviewContent className="flex-1 min-w-0 flex flex-col gap-4 p-3 sm:p-4 pb-28 sm:pb-4 overflow-y-auto">
            {selectedSegment ? (
              <>
                {/* Script text */}
                <div className={`rounded-2xl border px-5 py-4 ${isDarkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200'}`}>
                  {selectedSegment.speaker_label && (
                    <p className="text-xs font-semibold opacity-50 mb-1">{selectedSegment.speaker_label}</p>
                  )}
                  <p className="text-sm leading-relaxed">{selectedSegment.script_text}</p>
                </div>

                {/* Transport */}
                <div className="sticky bottom-3 z-10 sm:static">
                  <ReviewTransport
                    onPlay={playCurrentTake}
                    onPause={handlePause}
                    onNext={handleNext}
                    onPrev={handlePrev}
                    onReplay={handleReplay}
                    onApprove={handleApprove}
                    onFlag={handleFlag}
                    onAddMarker={() => setShowAddIssue(true)}
                    isPlaying={isPlaying}
                    currentSegmentIndex={currentIndex}
                    totalSegments={segments.length}
                    isDarkMode={isDarkMode}
                  />
                </div>

                {/* QC issues */}
                {selectedIssues.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold opacity-50 mb-1.5">QC Issues</p>
                    <QcIssueList
                      issues={selectedIssues}
                      projectId={project.id}
                      segmentId={selectedSegment.id}
                      onIssuesChange={updated => handleIssuesChange(selectedSegment.id, updated)}
                      isDarkMode={isDarkMode}
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center opacity-30 text-sm">
                Select a segment from the list.
              </div>
            )}
          </ReviewContent>
        </div>
      )}

      {/* Add QC issue dialog */}
      {showAddIssue && selectedSegment && (
        <QcIssueDialog
          projectId={project.id}
          segmentId={selectedSegment.id}
          takeId={selectedTake?.id}
          onSave={handleIssueSaved}
          onClose={() => setShowAddIssue(false)}
          isDarkMode={isDarkMode}
        />
      )}
    </div>
  );
}
