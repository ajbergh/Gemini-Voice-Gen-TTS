/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ProjectSettingsPanel.tsx - Project-level render default editor.
 *
 * Lets users set default voice, language, provider/model, fallback provider,
 * and performance style values inherited by newly rendered segments.
 */

import React from 'react';
import { Check, Loader2, X } from 'lucide-react';
import { CustomPreset, PerformanceStyle, ScriptProject, Voice } from '../types';
import StylePresetPicker from './StylePresetPicker';

const TTS_MODELS: { value: string; label: string }[] = [
  { value: 'gemini-3.1-flash-tts-preview', label: '3.1 Flash' },
  { value: 'gemini-2.5-flash-preview-tts', label: '2.5 Flash' },
  { value: 'gemini-2.5-pro-preview-tts',   label: '2.5 Pro'   },
];

interface ProjectSettingsPanelProps {
  selectedProject: ScriptProject;
  voices: Voice[];
  customPresets?: CustomPreset[];
  styles: PerformanceStyle[];
  settingsVoice: string;
  settingsLang: string;
  settingsModel: string;
  settingsStyleId: number | null;
  savingSettings: boolean;
  onChangeVoice: (v: string) => void;
  onChangeLang: (v: string) => void;
  onChangeModel: (v: string) => void;
  onChangeStyleId: (id: number | null) => void;
  onStyleCreated: (s: PerformanceStyle) => void;
  onSave: () => void;
  onClose: () => void;
  mobile?: boolean;
}

/** Render editable defaults for the selected script project. */
const ProjectSettingsPanel: React.FC<ProjectSettingsPanelProps> = ({
  selectedProject,
  voices,
  customPresets = [],
  styles,
  settingsVoice,
  settingsLang,
  settingsModel,
  settingsStyleId,
  savingSettings,
  onChangeVoice,
  onChangeLang,
  onChangeModel,
  onChangeStyleId,
  onStyleCreated,
  onSave,
  onClose,
  mobile = false,
}) => (
  <div className={mobile ? 'space-y-4' : 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-4'}>
    <div className="flex items-center justify-between gap-2">
      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Project defaults</p>
      <button
        type="button"
        onClick={onClose}
        className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
      >
        <X size={14} />
      </button>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Default voice
        </label>
        <select
          value={settingsVoice}
          onChange={e => onChangeVoice(e.target.value)}
          className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
        >
          <option value="">— None —</option>
          {voices.length > 0 && (
            <optgroup label="Stock voices">
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name}</option>
              ))}
            </optgroup>
          )}
          {customPresets.length > 0 && (
            <optgroup label="My voices">
              {customPresets.map(p => (
                <option key={`preset:${p.id}`} value={`preset:${p.id}`}>{p.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      </div>
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Language code
        </label>
        <input
          value={settingsLang}
          onChange={e => onChangeLang(e.target.value)}
          placeholder="e.g. en-US"
          className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 text-sm text-zinc-900 dark:text-white placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
        />
      </div>
      <div className="space-y-1">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Model
        </label>
        <select
          value={settingsModel}
          onChange={e => onChangeModel(e.target.value)}
          className="h-9 w-full rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 text-sm text-zinc-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
        >
          {TTS_MODELS.map(m => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>
      <div className="space-y-1 sm:col-span-2">
        <label className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Default performance style
        </label>
        <StylePresetPicker
          styles={styles}
          value={settingsStyleId}
          onChange={onChangeStyleId}
          projectId={selectedProject.id}
          onStyleCreated={onStyleCreated}
        />
      </div>
    </div>
    <div className={mobile ? 'sticky bottom-0 -mx-4 flex justify-end gap-2 border-t border-zinc-200 dark:border-zinc-800 bg-white/95 dark:bg-zinc-950/95 px-4 py-3 backdrop-blur' : 'flex justify-end gap-2 pt-1'}>
      <button
        type="button"
        onClick={onClose}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={savingSettings}
        onClick={onSave}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-4 text-xs font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
      >
        {savingSettings ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
        Save settings
      </button>
    </div>
  </div>
);

export default ProjectSettingsPanel;
