/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CastProfileCard.tsx — A single cast profile card for the Cast Board grid.
 *
 * Shows name, role badge, assigned voice, description snippet, age impression,
 * emotional range, and a first sample line. Action buttons (edit, audition,
 * delete) appear on hover.
 */

import React from 'react';
import { Mic, Pencil, Trash2 } from 'lucide-react';
import { CastProfile } from '../types';

interface CastProfileCardProps {
  profile: CastProfile;
  onEdit: (profile: CastProfile) => void;
  onAudition: (profile: CastProfile) => void;
  onDelete: (profile: CastProfile) => void;
}

const ROLE_BADGE: Record<string, string> = {
  narrator:    'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  protagonist: 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300',
  antagonist:  'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  supporting:  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300',
  extra:       'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400',
  brand_voice: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  archived:    'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500',
};

const ROLE_LABELS: Record<string, string> = {
  narrator:    'Narrator',
  protagonist: 'Protagonist',
  antagonist:  'Antagonist',
  supporting:  'Supporting',
  extra:       'Extra',
  brand_voice: 'Brand Voice',
  archived:    'Archived',
};

function roleBadgeClass(role: string): string {
  return ROLE_BADGE[role] ?? ROLE_BADGE.extra;
}

function formatRole(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ');
}

const CastProfileCard: React.FC<CastProfileCardProps> = ({
  profile,
  onEdit,
  onAudition,
  onDelete,
}) => {
  const sampleLines: string[] = (() => {
    try { return JSON.parse(profile.sample_lines_json ?? '[]'); } catch { return []; }
  })();

  return (
    <div className="group relative rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 flex flex-col gap-3 hover:shadow-md dark:hover:shadow-zinc-900/50 transition-shadow">
      {/* Name + badges + action buttons */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-base font-semibold text-zinc-900 dark:text-white truncate">{profile.name}</h4>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${roleBadgeClass(profile.role)}`}
            >
              {formatRole(profile.role)}
            </span>
            {profile.voice_name && (
              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                {profile.voice_name}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons — visible on hover */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            type="button"
            onClick={() => onAudition(profile)}
            title="Audition voice"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
          >
            <Mic size={14} />
          </button>
          <button
            type="button"
            onClick={() => onEdit(profile)}
            title="Edit profile"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(profile)}
            title="Delete profile"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Description */}
      {profile.description && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-snug">
          {profile.description}
        </p>
      )}

      {/* Age impression + emotional range */}
      {(profile.age_impression || profile.emotional_range) && (
        <div className="flex flex-wrap gap-3 text-xs text-zinc-500 dark:text-zinc-400">
          {profile.age_impression && (
            <span>
              <span className="font-medium text-zinc-600 dark:text-zinc-300">Age: </span>
              {profile.age_impression}
            </span>
          )}
          {profile.emotional_range && (
            <span>
              <span className="font-medium text-zinc-600 dark:text-zinc-300">Range: </span>
              {profile.emotional_range}
            </span>
          )}
        </div>
      )}

      {/* First sample line */}
      {sampleLines.length > 0 && (
        <blockquote className="rounded-lg border-l-2 border-zinc-200 dark:border-zinc-700 pl-3 text-xs italic text-zinc-400 dark:text-zinc-500 line-clamp-2">
          &ldquo;{sampleLines[0]}&rdquo;
        </blockquote>
      )}
    </div>
  );
};

export default CastProfileCard;
