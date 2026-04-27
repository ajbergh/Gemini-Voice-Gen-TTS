/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ReviewQueue.tsx - Filterable segment queue for take review.
 *
 * Shows the selected project's segments with approval/flag status and open-QC
 * badges so reviewers can jump between unreviewed, flagged, and issue-bearing items.
 */

import React from 'react';
import { AlertTriangle, CheckCircle, Flag } from 'lucide-react';
import type { ReviewFilter, ScriptSegment, SegmentTake, SegmentQcStatus } from '../types';

interface ReviewQueueProps {
  segments: ScriptSegment[];
  /** Map of segmentId → best (selected) take */
  takesMap: Record<number, SegmentTake | undefined>;
  /** Map of segmentId → open QC issue count */
  qcStatusMap: Record<number, number>;
  filter: ReviewFilter;
  onFilterChange: (f: ReviewFilter) => void;
  onSelectSegment: (segmentId: number) => void;
  selectedSegmentId: number | null;
  isDarkMode?: boolean;
}

const FILTER_LABELS: { value: ReviewFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unreviewed', label: 'Unreviewed' },
  { value: 'flagged', label: 'Flagged' },
  { value: 'open_issues', label: 'Open Issues' },
];

/** Return the compact status icon for a segment's selected/best take. */
function getTakeStatusIcon(take: SegmentTake | undefined) {
  if (!take) return null;
  if (take.status === 'approved') return <CheckCircle size={13} className="text-green-500 shrink-0" />;
  if (take.status === 'flagged') return <Flag size={13} className="text-red-500 shrink-0" />;
  return null;
}

/** Decide whether a segment belongs in the currently selected review filter. */
function matchesFilter(
  segment: ScriptSegment,
  take: SegmentTake | undefined,
  openCount: number,
  filter: ReviewFilter,
): boolean {
  switch (filter) {
    case 'all': return true;
    case 'unreviewed': return !take || (take.status !== 'approved' && take.status !== 'flagged');
    case 'flagged': return !!take && take.status === 'flagged';
    case 'open_issues': return openCount > 0;
    default: return true;
  }
}

/** Render the review queue and filter controls for a project's segments. */
export default function ReviewQueue({
  segments,
  takesMap,
  qcStatusMap,
  filter,
  onFilterChange,
  onSelectSegment,
  selectedSegmentId,
  isDarkMode = false,
}: ReviewQueueProps) {
  const visible = segments.filter(s => matchesFilter(s, takesMap[s.id], qcStatusMap[s.id] ?? 0, filter));

  const bg = isDarkMode ? 'bg-zinc-900 border-zinc-700' : 'bg-white border-zinc-200';
  const filterBtnActive = isDarkMode ? 'bg-zinc-700 text-zinc-100' : 'bg-zinc-900 text-white';
  const filterBtnIdle = isDarkMode ? 'hover:bg-zinc-800 text-zinc-400' : 'hover:bg-zinc-100 text-zinc-500';

  return (
    <div className={`flex flex-col h-full rounded-2xl border overflow-hidden ${bg}`}>
      {/* Filter bar */}
      <div className={`flex gap-1 p-2 border-b ${isDarkMode ? 'border-zinc-700' : 'border-zinc-100'}`}>
        {FILTER_LABELS.map(f => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`flex-1 rounded-lg py-1 text-xs font-medium transition-colors ${filter === f.value ? filterBtnActive : filterBtnIdle}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Segment list */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 && (
          <p className="text-center text-xs opacity-40 py-8">No segments match this filter.</p>
        )}
        {visible.map(segment => {
          const take = takesMap[segment.id];
          const openCount = qcStatusMap[segment.id] ?? 0;
          const isSelected = segment.id === selectedSegmentId;
          const rowBg = isSelected
            ? isDarkMode ? 'bg-zinc-700' : 'bg-zinc-100'
            : isDarkMode ? 'hover:bg-zinc-800' : 'hover:bg-zinc-50';

          return (
            <button
              key={segment.id}
              onClick={() => onSelectSegment(segment.id)}
              className={`w-full flex items-start gap-2 px-3 py-2.5 text-left transition-colors border-b ${isDarkMode ? 'border-zinc-800' : 'border-zinc-50'} ${rowBg}`}
            >
              {/* Status icon */}
              <span className="mt-0.5">{getTakeStatusIcon(take)}</span>

              {/* Text */}
              <div className="flex-1 min-w-0">
                {segment.speaker_label && (
                  <p className="text-[10px] font-medium opacity-50 truncate">{segment.speaker_label}</p>
                )}
                <p className="text-xs truncate opacity-80">{segment.script_text}</p>
              </div>

              {/* QC badge */}
              {openCount > 0 && (
                <span className="shrink-0 flex items-center gap-0.5 text-[10px] font-semibold text-yellow-600 bg-yellow-100 dark:bg-yellow-900/40 dark:text-yellow-400 rounded-full px-1.5 py-0.5">
                  <AlertTriangle size={10} /> {openCount}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
