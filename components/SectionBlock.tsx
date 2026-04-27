/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SectionBlock.tsx - Editable section container for project segments.
 *
 * Owns the expanded/collapsed section row, section edit form, add-segment form,
 * and the SegmentRow list for all segments assigned to a section.
 */

import React from 'react';
import { Check, ChevronDown, ChevronRight, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { CastProfile, PerformanceStyle, ScriptSection, ScriptSegment, Voice } from '../types';
import SegmentRow from './SegmentRow';

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

interface SectionBlockProps {
  section: ScriptSection;
  sectionSegments: ScriptSegment[];
  projectId: number;
  isExpanded: boolean;
  editingSectionId: number | null;
  editingSectionTitle: string;
  editingSectionKind: string;
  savingSectionEdit: boolean;
  addingToSectionId: number | 'unsectioned' | null;
  newSegmentText: string;
  savingSegment: boolean;
  editingSegmentId: number | null;
  editState: SegmentEditState;
  savingSegmentEdit: boolean;
  renderingSegmentId: number | null;
  castProfiles: CastProfile[];
  voices: Voice[];
  styles: PerformanceStyle[];
  statusBadge: (status: string) => string;
  defaultVoiceName?: string;
  onToggle: (id: number) => void;
  onEditSection: (section: ScriptSection) => void;
  onCancelSectionEdit: () => void;
  onSaveSectionEdit: (section: ScriptSection) => void;
  onDeleteSection: (id: number) => void;
  onSectionTitleChange: (v: string) => void;
  onSectionKindChange: (v: string) => void;
  onSetAddingToSection: (id: number | 'unsectioned' | null) => void;
  onNewSegmentTextChange: (v: string) => void;
  onAddSegment: (e: React.FormEvent, sectionId: number | null) => void;
  onEditSegment: (segment: ScriptSegment) => void;
  onCancelSegmentEdit: () => void;
  onSaveSegmentEdit: (segment: ScriptSegment) => void;
  onDeleteSegment: (id: number) => void;
  onReRenderSegment: (segment: ScriptSegment) => void;
  onTakesChanged: () => void;
  onSegmentEditStateChange: (patch: Partial<SegmentEditState>) => void;
  onStyleCreated: (s: PerformanceStyle) => void;
}

/** Render one project section with inline section and segment editing controls. */
const SectionBlock: React.FC<SectionBlockProps> = ({
  section,
  sectionSegments,
  projectId,
  isExpanded,
  editingSectionId,
  editingSectionTitle,
  editingSectionKind,
  savingSectionEdit,
  addingToSectionId,
  newSegmentText,
  savingSegment,
  editingSegmentId,
  editState,
  savingSegmentEdit,
  renderingSegmentId,
  castProfiles,
  voices,
  styles,
  statusBadge,
  defaultVoiceName,
  onToggle,
  onEditSection,
  onCancelSectionEdit,
  onSaveSectionEdit,
  onDeleteSection,
  onSectionTitleChange,
  onSectionKindChange,
  onSetAddingToSection,
  onNewSegmentTextChange,
  onAddSegment,
  onEditSegment,
  onCancelSegmentEdit,
  onSaveSegmentEdit,
  onDeleteSegment,
  onReRenderSegment,
  onTakesChanged,
  onSegmentEditStateChange,
  onStyleCreated,
}) => {
  const isEditingTitle = editingSectionId === section.id;
  const isAddingHere = addingToSectionId === section.id;

  return (
    <div className="group/section rounded-xl border border-zinc-200 dark:border-zinc-800">
      {/* Section header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => onToggle(section.id)}
          className="flex items-center gap-2 min-w-0 flex-1 text-left"
        >
          {isExpanded
            ? <ChevronDown size={14} className="shrink-0 text-zinc-400" />
            : <ChevronRight size={14} className="shrink-0 text-zinc-400" />}
          {isEditingTitle ? (
            <div className="flex min-w-0 flex-1 items-center gap-2" onClick={e => e.stopPropagation()}>
              <select
                value={editingSectionKind}
                onChange={e => onSectionKindChange(e.target.value)}
                className="h-7 shrink-0 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-1.5 text-xs text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
              >
                <option value="chapter">Chapter</option>
                <option value="scene">Scene</option>
                <option value="folder">Folder</option>
              </select>
              <input
                autoFocus
                value={editingSectionTitle}
                onChange={e => onSectionTitleChange(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') { e.preventDefault(); onSaveSectionEdit(section); }
                  if (e.key === 'Escape') onCancelSectionEdit();
                }}
                className="min-w-0 flex-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-2 py-0.5 text-sm font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
              />
            </div>
          ) : (
            <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-100">{section.title}</span>
          )}
          <span className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">
            {sectionSegments.length}
          </span>
        </button>

        {isEditingTitle ? (
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={savingSectionEdit}
              onClick={() => onSaveSectionEdit(section)}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors disabled:opacity-50"
            >
              {savingSectionEdit ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
            </button>
            <button
              type="button"
              onClick={onCancelSectionEdit}
              className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover/section:opacity-100 focus-within:opacity-100">
            <button
              type="button"
              title="Rename section"
              onClick={() => onEditSection(section)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              title="Delete section"
              onClick={() => onDeleteSection(section.id)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-red-500 transition-colors"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Section body */}
      {isExpanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-3 pb-3 pt-2 space-y-2">
          {sectionSegments.length === 0 && !isAddingHere ? (
            <p className="text-xs text-zinc-400 dark:text-zinc-500 italic">No segments yet.</p>
          ) : (
            sectionSegments.map(seg => (
              <SegmentRow
                key={seg.id}
                segment={seg}
                projectId={projectId}
                isEditing={editingSegmentId === seg.id}
                editState={editState}
                savingEdit={savingSegmentEdit}
                renderingId={renderingSegmentId}
                castProfiles={castProfiles}
                voices={voices}
                styles={styles}
                statusBadge={statusBadge}
                defaultVoiceName={defaultVoiceName}
                onEdit={onEditSegment}
                onCancelEdit={onCancelSegmentEdit}
                onSaveEdit={onSaveSegmentEdit}
                onDelete={onDeleteSegment}
                onReRender={onReRenderSegment}
                onTakesChanged={onTakesChanged}
                onEditStateChange={onSegmentEditStateChange}
                onStyleCreated={onStyleCreated}
              />
            ))
          )}
          {/* Add segment form */}
          {isAddingHere ? (
            <form onSubmit={e => onAddSegment(e, section.id)} className="mt-2 space-y-2">
              <textarea
                autoFocus
                rows={3}
                value={newSegmentText}
                onChange={e => onNewSegmentTextChange(e.target.value)}
                placeholder="Enter segment text..."
                className="w-full resize-y rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onSetAddingToSection(null)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                >
                  <X size={12} /> Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSegment || !newSegmentText.trim()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-3 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
                >
                  {savingSegment ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                  Add
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => { onSetAddingToSection(section.id); onNewSegmentTextChange(''); }}
              className="mt-2 w-full flex items-center gap-2 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:border-zinc-400 dark:hover:border-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            >
              <Plus size={12} /> Add segment
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default SectionBlock;
