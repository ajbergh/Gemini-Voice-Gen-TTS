/**
 * SavePresetDialog.tsx — Custom Preset Save Confirmation
 *
 * Collects or confirms the preset name before saving an AI casting result as a
 * custom voice preset. Shows the base voice, the casting/persona context, and a
 * client-side progress indicator while the backend saves the preset and, when
 * available, generates the Gemini portrait.
 */

import React from 'react';
import { Loader2, Save, Sparkles, X } from 'lucide-react';

interface SavePresetDialogProps {
  voiceName: string;
  presetName: string;
  suggestedName: string;
  sourceQuery?: string;
  personDescription?: string;
  isSaving: boolean;
  progress: number;
  progressLabel: string;
  error?: string | null;
  onNameChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
}

const SavePresetDialog: React.FC<SavePresetDialogProps> = ({
  voiceName,
  presetName,
  suggestedName,
  sourceQuery,
  personDescription,
  isSaving,
  progress,
  progressLabel,
  error,
  onNameChange,
  onClose,
  onSave,
}) => {
  const trimmedQuery = sourceQuery?.trim();
  const trimmedPersonDescription = personDescription?.trim();
  const shouldGenerateHeadshot = !!trimmedPersonDescription;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-950/65 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-preset-title"
    >
      <div className="absolute inset-0" onClick={isSaving ? undefined : onClose}></div>
      <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-zinc-200/80 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <button
          onClick={onClose}
          disabled={isSaving}
          className="absolute right-4 top-4 z-10 rounded-full p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-zinc-800 dark:hover:text-white"
          aria-label="Close save preset dialog"
        >
          <X size={18} />
        </button>

        <div className="border-b border-zinc-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.18),_transparent_40%),linear-gradient(135deg,_rgba(24,24,27,0.03),_rgba(99,102,241,0.08))] px-6 pb-5 pt-6 dark:border-zinc-800 dark:bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.16),_transparent_35%),linear-gradient(135deg,_rgba(24,24,27,0.7),_rgba(79,70,229,0.18))]">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/70 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700 shadow-sm dark:border-amber-500/20 dark:bg-zinc-900/70 dark:text-amber-300">
            <Sparkles size={12} />
            Save Custom Voice
          </div>
          <h2 id="save-preset-title" className="mt-4 text-2xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Save this casting match
          </h2>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            {shouldGenerateHeadshot
              ? 'Store the voice with a polished name and generate a Gemini portrait from the persona description.'
              : 'Store the voice with a polished name so it is ready in your custom preset library.'}
          </p>
        </div>

        <div className="space-y-5 px-6 py-6">
          <div className="grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Base Voice</p>
                <p className="mt-1 text-lg font-semibold text-zinc-900 dark:text-white">{voiceName}</p>
              </div>
              {trimmedQuery && (
                <div className="max-w-[60%] rounded-2xl bg-white px-3 py-2 text-right text-xs leading-5 text-zinc-500 shadow-sm dark:bg-zinc-950 dark:text-zinc-400">
                  “{trimmedQuery}”
                </div>
              )}
            </div>
            {trimmedPersonDescription && (
              <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                Persona: {trimmedPersonDescription}
              </p>
            )}
          </div>

          <div>
            <label htmlFor="save-preset-name" className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-400">
              Preset Name
            </label>
            <input
              id="save-preset-name"
              type="text"
              value={presetName}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={isSaving}
              autoFocus
              maxLength={100}
              className="w-full rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-base font-medium text-zinc-900 outline-none transition focus:border-indigo-300 focus:ring-4 focus:ring-indigo-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:focus:border-indigo-700 dark:focus:ring-indigo-950"
            />
            <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
              Suggested name: <button type="button" onClick={() => onNameChange(suggestedName)} disabled={isSaving} className="font-semibold text-indigo-600 transition hover:text-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 dark:text-indigo-300 dark:hover:text-indigo-200">{suggestedName}</button>
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-200 bg-zinc-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">Gemini Artwork</p>
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                  {shouldGenerateHeadshot ? 'Generate portrait from persona' : 'Portrait generation unavailable'}
                </p>
              </div>
              {isSaving ? <Loader2 size={18} className="animate-spin text-indigo-500" /> : <Sparkles size={18} className="text-amber-500" />}
            </div>

            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {shouldGenerateHeadshot
                ? 'When you save, the backend will create the preset and ask Gemini to generate a square portrait for the custom voice persona.'
                : 'This result does not include a persona description, so the preset will save without a Gemini portrait.'}
            </p>

            <div className="mt-4 space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 via-indigo-500 to-sky-500 transition-[width] duration-300"
                  style={{ width: `${Math.max(progress, isSaving ? 8 : 0)}%` }}
                ></div>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
                <span>{isSaving ? progressLabel : shouldGenerateHeadshot ? 'Ready to generate artwork during save' : 'Ready to save preset'}</span>
                <span>{Math.round(progress)}%</span>
              </div>
            </div>
          </div>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-900 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={isSaving || !presetName.trim()}
              className="inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isSaving ? 'Saving preset...' : 'Save voice'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SavePresetDialog;