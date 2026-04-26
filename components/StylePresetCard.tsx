/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * StylePresetCard.tsx — A single performance style preset card for the style
 * library grid. Shows name, category badge, pacing / energy / emotion
 * descriptors, a director's notes preview, and builtin indicator. Edit and
 * delete hover actions appear for user-created styles.
 */

import React from 'react';
import { Pencil, Trash2, Lock } from 'lucide-react';
import { PerformanceStyle } from '../types';

interface StylePresetCardProps {
  style: PerformanceStyle;
  onEdit: (style: PerformanceStyle) => void;
  onDelete: (style: PerformanceStyle) => void;
}

const CATEGORY_BADGE: Record<string, string> = {
  narration:    'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  commercial:   'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  education:    'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  character:    'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  wellness:     'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  documentary:  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  trailer:      'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  custom:       'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400',
};

function categoryBadgeClass(category: string): string {
  return CATEGORY_BADGE[category] ?? CATEGORY_BADGE.custom;
}

function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
}

const DESCRIPTOR_LABEL: Record<string, string> = {
  pacing:        'Pacing',
  energy:        'Energy',
  emotion:       'Emotion',
  articulation:  'Articulation',
  pause_density: 'Pauses',
};

const StylePresetCard: React.FC<StylePresetCardProps> = ({ style, onEdit, onDelete }) => {
  const descriptors: Array<{ key: string; value: string }> = (
    ['pacing', 'energy', 'emotion', 'articulation', 'pause_density'] as const
  )
    .filter((k) => (style[k as keyof PerformanceStyle] as string | undefined))
    .map((k) => ({ key: DESCRIPTOR_LABEL[k], value: style[k as keyof PerformanceStyle] as string }));

  return (
    <div className="group relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex flex-col gap-3 hover:shadow-md dark:hover:shadow-zinc-900/50 transition-shadow">
      {/* Header: name + badges + action buttons */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-zinc-900 dark:text-white truncate">{style.name}</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${categoryBadgeClass(style.category)}`}
            >
              {formatCategory(style.category)}
            </span>
            {style.is_builtin && (
              <span className="inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
                <Lock size={9} />
                Built-in
              </span>
            )}
            {style.scope === 'project' && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300">
                Project
              </span>
            )}
          </div>
        </div>

        {/* Action buttons — edit/delete only for non-builtins */}
        {!style.is_builtin && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
            <button
              type="button"
              onClick={() => onEdit(style)}
              title="Edit style"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => onDelete(style)}
              title="Delete style"
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Description */}
      {style.description && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug">
          {style.description}
        </p>
      )}

      {/* Pacing / energy / emotion / articulation / pause_density chips */}
      {descriptors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {descriptors.map(({ key, value }) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-full border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 text-[11px] text-zinc-600 dark:text-zinc-300"
            >
              <span className="text-zinc-400 dark:text-zinc-500">{key}:</span>
              {value}
            </span>
          ))}
        </div>
      )}

      {/* Director's notes preview */}
      {style.director_notes && (
        <p className="text-xs text-zinc-400 dark:text-zinc-500 italic line-clamp-2 leading-relaxed border-t border-zinc-100 dark:border-zinc-800 pt-2">
          "{style.director_notes}"
        </p>
      )}
    </div>
  );
};

export default StylePresetCard;
