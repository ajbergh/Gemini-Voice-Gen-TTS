/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Flag,
  Pause,
  Play,
  RefreshCcw,
  MapPin,
} from 'lucide-react';

interface ReviewTransportProps {
  onPlay: () => void;
  onPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  onReplay: () => void;
  onApprove: () => void;
  onFlag: () => void;
  onAddMarker: () => void;
  isPlaying: boolean;
  currentSegmentIndex: number;
  totalSegments: number;
  isDarkMode?: boolean;
}

const HOTKEYS = [
  { key: 'Space', label: 'Play/Pause' },
  { key: 'A', label: 'Approve' },
  { key: 'F', label: 'Flag' },
  { key: 'R', label: 'Replay' },
  { key: 'N', label: 'Next' },
  { key: 'P', label: 'Prev' },
  { key: 'M', label: 'Marker' },
];

export default function ReviewTransport({
  onPlay,
  onPause,
  onNext,
  onPrev,
  onReplay,
  onApprove,
  onFlag,
  onAddMarker,
  isPlaying,
  currentSegmentIndex,
  totalSegments,
  isDarkMode = false,
}: ReviewTransportProps) {
  const bg = isDarkMode ? 'bg-zinc-900/90 border-zinc-700' : 'bg-white/90 border-zinc-200';
  const btnBase = `flex min-h-11 min-w-11 items-center justify-center rounded-xl p-2.5 transition-colors`;
  const btnSecondary = isDarkMode ? `${btnBase} hover:bg-zinc-800 text-zinc-300` : `${btnBase} hover:bg-zinc-100 text-zinc-600`;
  const kbdCls = `px-1.5 py-0.5 rounded text-[10px] font-mono ${isDarkMode ? 'bg-zinc-700 text-zinc-300' : 'bg-zinc-100 text-zinc-600'}`;

  return (
    <div className={`flex flex-col gap-3 rounded-2xl border px-3 py-3 sm:px-4 backdrop-blur-sm ${bg}`}>
      {/* Controls row */}
      <div className="flex items-center justify-between gap-2">
        {/* Prev */}
        <button onClick={onPrev} disabled={currentSegmentIndex === 0} aria-label="Previous segment" className={`${btnSecondary} disabled:opacity-30`}>
          <ChevronLeft size={20} />
        </button>

        {/* Replay */}
        <button onClick={onReplay} aria-label="Replay" className={btnSecondary}>
          <RefreshCcw size={18} />
        </button>

        {/* Play/Pause */}
        <button
          onClick={isPlaying ? onPause : onPlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          className={`${btnBase} px-5 py-2.5 rounded-xl font-medium text-sm gap-2 ${isDarkMode ? 'bg-zinc-700 hover:bg-zinc-600 text-zinc-100' : 'bg-zinc-900 hover:bg-zinc-700 text-white'}`}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} />}
          {isPlaying ? 'Pause' : 'Play'}
        </button>

        {/* Marker */}
        <button onClick={onAddMarker} aria-label="Add marker" className={btnSecondary}>
          <MapPin size={18} />
        </button>

        {/* Next */}
        <button onClick={onNext} disabled={currentSegmentIndex >= totalSegments - 1} aria-label="Next segment" className={`${btnSecondary} disabled:opacity-30`}>
          <ChevronRight size={20} />
        </button>
      </div>

      {/* Approve / Flag row */}
      <div className="flex gap-2">
        <button
          onClick={onApprove}
          aria-label="Approve take"
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium bg-green-600 hover:bg-green-700 text-white transition-colors"
        >
          <CheckCircle size={15} /> Approve
        </button>
        <button
          onClick={onFlag}
          aria-label="Flag take"
          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-2 text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          <Flag size={15} /> Flag
        </button>
      </div>

      {/* Progress indicator */}
      <div className="flex items-center justify-center">
        <span className="text-xs opacity-50">
          {totalSegments > 0 ? `${currentSegmentIndex + 1} / ${totalSegments}` : '—'}
        </span>
      </div>

      {/* Hotkey hint strip */}
      <div className="hidden sm:flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
        {HOTKEYS.map(h => (
          <span key={h.key} className="flex items-center gap-1 text-[10px] opacity-60">
            <kbd className={kbdCls}>{h.key}</kbd>
            <span>{h.label}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
