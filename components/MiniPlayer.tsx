/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * MiniPlayer.tsx — Floating Mini Audio Player
 *
 * A persistent bottom bar that shows the currently playing audio track with
 * voice name, subtitle, progress bar, and play/stop controls. Only visible
 * when audio is actively playing. Uses the global AudioProvider context.
 */

import React from 'react';
import { Square, Volume2, Mic, Clock } from 'lucide-react';
import { useAudio } from './AudioProvider';

const MiniPlayer: React.FC = () => {
  const { isPlaying, currentTrack, progress, duration, stop } = useAudio();

  if (!isPlaying || !currentTrack) return null;

  const sourceIcon = currentTrack.source === 'sample' ? <Mic size={14} /> :
                     currentTrack.source === 'history' ? <Clock size={14} /> :
                     <Volume2 size={14} />;

  const sourceColor = currentTrack.source === 'sample' ? 'bg-emerald-500' :
                      currentTrack.source === 'history' ? 'bg-violet-500' :
                      'bg-blue-500';

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed bottom-14 left-0 right-0 z-[60] xl:bottom-0 xl:left-[68px] transition-all animate-slide-up">
      {/* Progress bar */}
      <div className="h-0.5 bg-zinc-200 dark:bg-zinc-700 w-full">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-[width] duration-100"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 px-4 py-2.5 flex items-center gap-3">
        {/* Source badge */}
        <div className={`flex-shrink-0 h-8 w-8 rounded-full ${sourceColor} flex items-center justify-center text-white`}>
          {sourceIcon}
        </div>

        {/* Track info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-900 dark:text-white truncate">
            {currentTrack.label}
          </p>
          {currentTrack.subtitle && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {currentTrack.subtitle}
            </p>
          )}
        </div>

        {/* Time */}
        {duration > 0 && (
          <span className="text-xs text-zinc-400 dark:text-zinc-500 tabular-nums flex-shrink-0">
            {formatTime(progress * duration)} / {formatTime(duration)}
          </span>
        )}

        {/* Stop button */}
        <button
          onClick={stop}
          className="flex-shrink-0 p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-white transition-colors"
          aria-label="Stop playback"
        >
          <Square size={14} className="fill-current" />
        </button>
      </div>
    </div>
  );
};

export default MiniPlayer;
