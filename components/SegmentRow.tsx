/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SegmentRow.tsx - Inline editor and take summary for a script segment.
 *
 * Switches between read and edit states, exposing text, speaker, voice/cast,
 * provider/model, fallback, style, render, delete, and take-list controls.
 */

import React from 'react';
import { Check, Loader2, Pencil, RefreshCw, Trash2, X } from 'lucide-react';
import { CastProfile, PerformanceStyle, ScriptSegment, Voice } from '../types';
import StylePresetPicker from './StylePresetPicker';
import SegmentTakeList from './SegmentTakeList';

interface SegmentEditState {
  text: string;
  speaker: string;
  voice: string;
  castProfileId: number | null;
  styleId: number | null;
  provider: string;
  model: string;
  fallbackProvider: string;
  fallbackModel: string;
}

interface SegmentRowProps {
  segment: ScriptSegment;
  projectId: number;
  isEditing: boolean;
  editState: SegmentEditState;
  savingEdit: boolean;
  renderingId: number | null;
  castProfiles: CastProfile[];
  voices: Voice[];
  styles: PerformanceStyle[];
  statusBadge: (status: string) => string;
  onEdit: (segment: ScriptSegment) => void;
  onCancelEdit: () => void;
  onSaveEdit: (segment: ScriptSegment) => void;
  onDelete: (id: number) => void;
  onReRender: (segment: ScriptSegment) => void;
  onTakesChanged: () => void;
  onEditStateChange: (patch: Partial<SegmentEditState>) => void;
  onStyleCreated: (s: PerformanceStyle) => void;
  defaultVoiceName?: string;
}

/** Render a single script segment row in display or inline-edit mode. */
const SegmentRow: React.FC<SegmentRowProps> = ({
  segment,
  projectId,
  isEditing,
  editState,
  savingEdit,
  renderingId,
  castProfiles,
  voices,
  styles,
  statusBadge,
  onEdit,
  onCancelEdit,
  onSaveEdit,
  onDelete,
  onReRender,
  onTakesChanged,
  onEditStateChange,
  onStyleCreated,
  defaultVoiceName,
}) => {
  if (isEditing) {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3 space-y-2">
        <textarea
          autoFocus
          rows={4}
          value={editState.text}
          onChange={e => onEditStateChange({ text: e.target.value })}
          className="w-full resize-y rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
        />
        {/* Speaker + voice/cast assignment */}
        <div className="flex flex-wrap gap-2">
          <input
            value={editState.speaker}
            onChange={e => onEditStateChange({ speaker: e.target.value })}
            placeholder="Speaker label (optional)"
            className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
          />
          <select
            value={
              editState.castProfileId
                ? `cast:${editState.castProfileId}`
                : editState.voice
                  ? `voice:${editState.voice}`
                  : ''
            }
            onChange={e => {
              const val = e.target.value;
              if (val.startsWith('cast:')) {
                const id = parseInt(val.slice(5), 10);
                onEditStateChange({ castProfileId: id, voice: '' });
                if (!editState.speaker.trim()) {
                  const p = castProfiles.find(cp => cp.id === id);
                  if (p) onEditStateChange({ speaker: p.name });
                }
              } else if (val.startsWith('voice:')) {
                onEditStateChange({ castProfileId: null, voice: val.slice(6) });
              } else {
                onEditStateChange({ castProfileId: null, voice: '' });
              }
            }}
            className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
          >
            <option value="">— No voice override —</option>
            {castProfiles.length > 0 && (
              <optgroup label="Cast Profiles">
                {castProfiles.map(p => (
                  <option key={`cast:${p.id}`} value={`cast:${p.id}`}>
                    {p.name}{p.voice_name ? ` (${p.voice_name})` : ''}
                  </option>
                ))}
              </optgroup>
            )}
            <optgroup label="Individual Voices">
              {voices.map(v => (
                <option key={`voice:${v.name}`} value={`voice:${v.name}`}>{v.name}</option>
              ))}
            </optgroup>
          </select>
        </div>
        {/* Style preset picker */}
        <StylePresetPicker
          styles={styles}
          value={editState.styleId}
          onChange={id => onEditStateChange({ styleId: id })}
          projectId={projectId}
          onStyleCreated={onStyleCreated}
        />
        {/* Provider / model overrides */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <input
            value={editState.provider}
            onChange={e => onEditStateChange({ provider: e.target.value })}
            placeholder="Provider override"
            className="h-8 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
          />
          <input
            value={editState.model}
            onChange={e => onEditStateChange({ model: e.target.value })}
            placeholder="Model override"
            className="h-8 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
          />
          <input
            value={editState.fallbackProvider}
            onChange={e => onEditStateChange({ fallbackProvider: e.target.value })}
            placeholder="Fallback provider"
            className="h-8 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
          />
          <input
            value={editState.fallbackModel}
            onChange={e => onEditStateChange({ fallbackModel: e.target.value })}
            placeholder="Fallback model"
            className="h-8 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-xs text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
          />
        </div>
        <div className="flex items-center gap-2 justify-end">
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
          >
            <X size={12} /> Cancel
          </button>
          <button
            type="button"
            disabled={savingEdit}
            onClick={() => onSaveEdit(segment)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-3 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
          >
            {savingEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap">{segment.script_text}</p>
          {(segment.speaker_label || segment.voice_name || segment.cast_profile_id || segment.style_id || segment.provider || segment.fallback_provider) && (
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {segment.speaker_label && (
                <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {segment.speaker_label}
                </span>
              )}
              {segment.cast_profile_id && (
                <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 border border-violet-200 dark:border-violet-700 px-2 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300">
                  ◈ {castProfiles.find(p => p.id === segment.cast_profile_id)?.name ?? `Profile #${segment.cast_profile_id}`}
                </span>
              )}
              {segment.voice_name && !segment.cast_profile_id && (
                <span className="rounded-full bg-[var(--accent-50)] dark:bg-zinc-900 border border-[var(--accent-100)] dark:border-zinc-700 px-2 py-0.5 text-[10px] font-semibold text-[var(--accent-700)] dark:text-[var(--accent-300)]">
                  {segment.voice_name}
                </span>
              )}
              {segment.provider && (
                <span className="rounded-full bg-sky-100 dark:bg-sky-900/40 border border-sky-200 dark:border-sky-700 px-2 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                  {segment.provider}{segment.model ? ` / ${segment.model}` : ''}
                </span>
              )}
              {segment.fallback_provider && (
                <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-700 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                  fallback {segment.fallback_provider}{segment.fallback_model ? ` / ${segment.fallback_model}` : ''}
                </span>
              )}
              {segment.style_id && (
                <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-700 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  ✦ {styles.find(s => s.id === segment.style_id)?.name ?? `Style #${segment.style_id}`}
                </span>
              )}
            </div>
          )}
          <SegmentTakeList
            projectId={projectId}
            segment={segment}
            onTakesChanged={onTakesChanged}
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusBadge(segment.status)}`}>
            {segment.status}
          </span>
          {(segment.voice_name || segment.cast_profile_id || defaultVoiceName) && (
            <button
              type="button"
              title="Re-render segment"
              disabled={renderingId === segment.id}
              onClick={() => onReRender(segment)}
              className="hidden group-hover:inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-[var(--accent-500)] transition-colors disabled:opacity-50"
            >
              {renderingId === segment.id
                ? <Loader2 size={12} className="animate-spin" />
                : <RefreshCw size={12} />}
            </button>
          )}
          <button
            type="button"
            title="Edit segment"
            onClick={() => onEdit(segment)}
            className="hidden group-hover:inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            title="Delete segment"
            onClick={() => onDelete(segment.id)}
            className="hidden group-hover:inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-red-500 transition-colors"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SegmentRow;
