/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AudioTagsToolbar.tsx — Audio Tag Insertion Toolbar
 *
 * Renders a collapsible row of pill buttons for Gemini 3.1 Flash TTS audio
 * tags (e.g. [whispers], [excited], [laughs]). Tags are grouped by category
 * (Style, Emotion, Sound) and color-coded. Clicking a pill fires the
 * onInsertTag callback so the parent can insert it at the cursor position.
 */

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';
import { AUDIO_TAGS, AudioTagCategory } from '../constants';

interface AudioTagsToolbarProps {
  onInsertTag: (tag: string) => void;
}

const CATEGORY_META: Record<AudioTagCategory, { label: string; pillBg: string; pillText: string; pillBorder: string }> = {
  style: {
    label: 'Style',
    pillBg: 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50',
    pillText: 'text-blue-700 dark:text-blue-300',
    pillBorder: 'border-blue-200 dark:border-blue-800',
  },
  emotion: {
    label: 'Emotion',
    pillBg: 'bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/30 dark:hover:bg-amber-900/50',
    pillText: 'text-amber-700 dark:text-amber-300',
    pillBorder: 'border-amber-200 dark:border-amber-800',
  },
  action: {
    label: 'Sound',
    pillBg: 'bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50',
    pillText: 'text-emerald-700 dark:text-emerald-300',
    pillBorder: 'border-emerald-200 dark:border-emerald-800',
  },
};

const CATEGORIES: AudioTagCategory[] = ['style', 'emotion', 'action'];

/** Render quick-insert controls for supported Gemini audio style tags. */
const AudioTagsToolbar: React.FC<AudioTagsToolbarProps> = ({ onInsertTag }) => {
  const [expanded, setExpanded] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
        >
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          Audio Tags
        </button>
        <div className="relative">
          <button
            type="button"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            aria-label="Audio tags help"
          >
            <HelpCircle size={13} />
          </button>
          {showTooltip && (
            <div className="absolute right-0 top-6 z-10 w-56 p-2.5 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed">
              Insert audio tags into your script to control delivery style. Tags like <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">[whispers]</code> or <code className="bg-zinc-100 dark:bg-zinc-700 px-1 rounded">[laughs]</code> are spoken naturally by the TTS voice.
            </div>
          )}
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 animate-slide-down">
          {CATEGORIES.map(category => {
            const meta = CATEGORY_META[category];
            const tags = AUDIO_TAGS.filter(t => t.category === category);
            return (
              <div key={category} className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 w-12 shrink-0">
                  {meta.label}
                </span>
                {tags.map(tag => (
                  <button
                    key={tag.tag}
                    type="button"
                    onClick={() => onInsertTag(tag.tag)}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium border transition-colors cursor-pointer ${meta.pillBg} ${meta.pillText} ${meta.pillBorder}`}
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AudioTagsToolbar;
