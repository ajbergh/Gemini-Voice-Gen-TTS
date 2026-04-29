/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * StylePresetPicker.tsx — Compact inline dropdown for selecting a performance
 * style. Shows grouped options (Global styles / Project styles). Includes a
 * "None" option and a "Create new…" action that opens StylePresetEditor.
 */

import React, { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { PerformanceStyle } from '../types';
import StylePresetEditor from './StylePresetEditor';

interface StylePresetPickerProps {
  styles: PerformanceStyle[];
  value: number | null | undefined;
  onChange: (styleId: number | null) => void;
  /** When set, new styles are created scoped to this project. */
  projectId?: number;
  onStyleCreated?: (style: PerformanceStyle) => void;
  disabled?: boolean;
  className?: string;
}

/** Convert a style category identifier into display text. */
function formatCategory(category: string): string {
  return category.charAt(0).toUpperCase() + category.slice(1).replace(/_/g, ' ');
}

/** Render a project-aware performance-style selector with optional create flow. */
const StylePresetPicker: React.FC<StylePresetPickerProps> = ({
  styles,
  value,
  onChange,
  projectId,
  onStyleCreated,
  disabled = false,
  className = '',
}) => {
  const [showEditor, setShowEditor] = useState(false);

  const globalStyles  = styles.filter(s => s.scope === 'global');
  const projectStyles = styles.filter(s => s.scope === 'project');

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const raw = e.target.value;
    if (raw === '__create__') {
      setShowEditor(true);
      return;
    }
    onChange(raw === '' ? null : Number(raw));
  }

  function handleStyleSaved(saved: PerformanceStyle) {
    setShowEditor(false);
    onStyleCreated?.(saved);
    onChange(saved.id);
  }

  const selected = styles.find(s => s.id === value);

  return (
    <>
      <div className={`relative flex items-center gap-1.5 ${className}`}>
        {/* Icon */}
        <Sparkles
          size={14}
          className="shrink-0 text-zinc-400 dark:text-zinc-500"
          aria-hidden="true"
        />

        {/* Select */}
        <select
          value={value ?? ''}
          onChange={handleChange}
          disabled={disabled}
          className="h-8 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)] disabled:opacity-50 truncate"
          aria-label="Select performance style"
        >
          <option value="">— No style —</option>

          {globalStyles.length > 0 && (
            <optgroup label="Global styles">
              {globalStyles.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.category ? ` · ${formatCategory(s.category)}` : ''}
                </option>
              ))}
            </optgroup>
          )}

          {projectStyles.length > 0 && (
            <optgroup label="Project styles">
              {projectStyles.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}{s.category ? ` · ${formatCategory(s.category)}` : ''}
                </option>
              ))}
            </optgroup>
          )}

          <option value="__create__" className="text-[var(--accent-100)]">
            + Create new style…
          </option>
        </select>

        {/* Clear button — only when something is selected */}
        {value != null && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            title="Remove style"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
            aria-label="Clear style selection"
          >
            <span aria-hidden="true" className="text-sm leading-none">×</span>
          </button>
        )}
      </div>

      {/* Inline preview of selected style's category */}
      {selected && (
        <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500 pl-[22px]">
          {formatCategory(selected.category)}
          {selected.pacing ? ` · ${selected.pacing}` : ''}
          {selected.energy ? ` · ${selected.energy}` : ''}
          {selected.emotion ? ` · ${selected.emotion}` : ''}
        </p>
      )}

      {/* New style editor */}
      {showEditor && (
        <StylePresetEditor
          projectId={projectId}
          onSave={handleStyleSaved}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  );
};

export default StylePresetPicker;
