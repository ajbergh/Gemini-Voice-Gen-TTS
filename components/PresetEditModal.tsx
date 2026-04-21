/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PresetEditModal.tsx — Edit Custom Voice Preset Modal
 *
 * Simple modal for editing an existing custom voice preset's name and
 * system instruction. Implements focus trap, Escape-to-close, and proper
 * ARIA attributes per project accessibility conventions.
 */

import React, { useState, useRef, useEffect } from 'react';
import { X, Loader2, Plus, History, RotateCcw, RefreshCw } from 'lucide-react';
import { CustomPreset, PresetTag } from '../types';
import { setPresetTags, listPresetVersions, revertPresetVersion, PresetVersion } from '../api';
import { VOICE_DATA } from '../constants';
import PresetArtwork from './PresetArtwork';
import { getPresetHeadshotMetadata } from '../presetMetadata';

interface PresetEditModalProps {
  preset: CustomPreset;
  onSave: (id: number, data: { name?: string; system_instruction?: string; color?: string }) => Promise<void>;
  onClose: () => void;
  onRegenerateHeadshot?: (id: number) => Promise<void>;
}

const TAG_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
];

const PRESET_COLORS = [
  '#6366f1', // indigo
  '#ec4899', // pink
  '#f59e0b', // amber
  '#10b981', // emerald
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ef4444', // red
  '#14b8a6', // teal
  '#f97316', // orange
  '#06b6d4', // cyan
];

const PresetEditModal: React.FC<PresetEditModalProps> = ({ preset, onSave, onClose, onRegenerateHeadshot }) => {
  const [name, setName] = useState(preset.name);
  const [systemInstruction, setSystemInstruction] = useState(preset.system_instruction || '');
  const [presetColor, setPresetColor] = useState(preset.color || '#6366f1');
  const [tags, setTags] = useState<PresetTag[]>(preset.tags || []);
  const [newTag, setNewTag] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [versions, setVersions] = useState<PresetVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [revertingId, setRevertingId] = useState<number | null>(null);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const baseVoice = VOICE_DATA.find(v => v.name === preset.voice_name);
  const hasHeadshot = !!getPresetHeadshotMetadata(preset);
  const hasCastingDirector = !!preset.metadata_json && preset.metadata_json.includes('"castingDirector"');

  useEffect(() => {
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll(
        'button, input, textarea, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey) {
        if (document.activeElement === first) { last.focus(); e.preventDefault(); }
      } else {
        if (document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) { setError('Name is required.'); return; }

    setIsSaving(true);
    setError(null);
    try {
      await setPresetTags(preset.id, tags.map(t => ({ tag: t.tag, color: t.color })));
      await onSave(preset.id, {
        name: trimmedName !== preset.name ? trimmedName : undefined,
        system_instruction: systemInstruction !== preset.system_instruction ? systemInstruction : undefined,
        color: presetColor !== preset.color ? presetColor : undefined,
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update preset.';
      setError(msg.includes('UNIQUE') ? `A preset named "${trimmedName}" already exists.` : msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    if (tags.some(t => t.tag.toLowerCase() === trimmed.toLowerCase())) return;
    setTags([...tags, { tag: trimmed, color: newTagColor }]);
    setNewTag('');
    const idx = TAG_COLORS.indexOf(newTagColor);
    setNewTagColor(TAG_COLORS[(idx + 1) % TAG_COLORS.length]);
  };

  const handleRemoveTag = (tagName: string) => {
    setTags(tags.filter(t => t.tag !== tagName));
  };

  const handleToggleVersions = async () => {
    if (showVersions) { setShowVersions(false); return; }
    setShowVersions(true);
    setLoadingVersions(true);
    try {
      const data = await listPresetVersions(preset.id);
      setVersions(data || []);
    } catch {
      setVersions([]);
    } finally {
      setLoadingVersions(false);
    }
  };

  const handleRevert = async (versionId: number) => {
    setRevertingId(versionId);
    try {
      const updated = await revertPresetVersion(preset.id, versionId);
      setName(updated.name);
      setSystemInstruction(updated.system_instruction || '');
      setPresetColor(updated.color || '#6366f1');
      const data = await listPresetVersions(preset.id);
      setVersions(data || []);
    } catch {
      setError('Failed to revert to this version.');
    } finally {
      setRevertingId(null);
    }
  };

  const formatVersionDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="preset-edit-title"
    >
      <div className="absolute inset-0" onClick={onClose}></div>
      <div
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl animate-slide-up outline-none"
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors z-50"
          aria-label="Close dialog"
        >
          <X size={18} />
        </button>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <h2 id="preset-edit-title" className="text-lg font-bold text-zinc-900 dark:text-white">Edit Preset</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Voice: {preset.voice_name}</p>

          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/40 p-3">
            <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <PresetArtwork
                presetId={preset.id}
                hasHeadshot={hasHeadshot}
                fallbackImageUrl={baseVoice?.imageUrl}
                alt={preset.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/40 via-transparent to-white/10 dark:from-zinc-950/55 dark:to-zinc-950/5"></div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
                {hasHeadshot ? 'Generated Headshot' : baseVoice?.imageUrl ? 'Voice Artwork' : 'Artwork Status'}
              </p>
              <p className="text-sm text-zinc-700 dark:text-zinc-200 leading-relaxed">
                {hasHeadshot
                  ? 'This preset is using its Gemini-generated portrait.'
                  : baseVoice?.imageUrl
                    ? `No preset headshot cached. Using ${baseVoice.name} fallback artwork.`
                    : 'No artwork is currently available for this preset.'}
              </p>
              {hasCastingDirector && onRegenerateHeadshot && (
                <button
                  type="button"
                  onClick={async () => {
                    setIsRegenerating(true);
                    setRegenerateError(null);
                    try {
                      await onRegenerateHeadshot(preset.id);
                    } catch (err: any) {
                      setRegenerateError(err?.message || 'Failed to regenerate headshot.');
                    } finally {
                      setIsRegenerating(false);
                    }
                  }}
                  disabled={isRegenerating || isSaving}
                  className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-medium text-indigo-500 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:opacity-40 transition-colors"
                >
                  {isRegenerating
                    ? <><Loader2 size={12} className="animate-spin" />&nbsp;Generating...</>
                    : <><RefreshCw size={12} />&nbsp;Regenerate headshot</>}
                </button>
              )}
              {regenerateError && (
                <p className="mt-1 text-[10px] text-red-500 dark:text-red-400 leading-snug">{regenerateError}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Preset Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
              maxLength={100}
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">System Instruction</label>
            <textarea
              value={systemInstruction}
              onChange={e => setSystemInstruction(e.target.value)}
              rows={6}
              className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 resize-none"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Tags</label>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map(t => (
                  <span
                    key={t.tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(t.tag)}
                      className="hover:opacity-70 transition-opacity"
                      aria-label={`Remove tag ${t.tag}`}
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                {TAG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewTagColor(c)}
                    className={`w-4 h-4 rounded-full transition-transform ${newTagColor === c ? 'ring-2 ring-offset-1 ring-zinc-400 dark:ring-zinc-500 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
              <input
                type="text"
                value={newTag}
                onChange={e => setNewTag(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                placeholder="Add tag..."
                className="flex-1 px-2 py-1 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
                maxLength={30}
              />
              <button
                type="button"
                onClick={handleAddTag}
                disabled={!newTag.trim()}
                className="p-1 text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-30 transition-colors"
                aria-label="Add tag"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>

          {/* Color Accent */}
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">Color Accent</label>
            <div className="flex items-center gap-1.5">
              {PRESET_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setPresetColor(c)}
                  className={`w-6 h-6 rounded-full transition-transform ${presetColor === c ? 'ring-2 ring-offset-2 ring-zinc-400 dark:ring-zinc-500 dark:ring-offset-zinc-900 scale-110' : 'hover:scale-110'}`}
                  style={{ backgroundColor: c }}
                  aria-label={`Select preset color ${c}`}
                />
              ))}
            </div>
          </div>

          {/* Version History */}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-3">
            <button
              type="button"
              onClick={handleToggleVersions}
              className="flex items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
            >
              <History size={14} />
              Version History
              <span className="text-zinc-400 dark:text-zinc-500">{showVersions ? 'v' : '>'}</span>
            </button>

            {showVersions && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1.5">
                {loadingVersions ? (
                  <div className="flex items-center justify-center py-3">
                    <Loader2 size={14} className="animate-spin text-zinc-400" />
                  </div>
                ) : versions.length === 0 ? (
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 py-2">No previous versions.</p>
                ) : (
                  versions.map(v => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between p-2 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-100 dark:border-zinc-800"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300 truncate">{v.name}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">{formatVersionDate(v.created_at)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRevert(v.id)}
                        disabled={revertingId === v.id}
                        className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded transition-colors"
                        title="Revert to this version"
                      >
                        {revertingId === v.id ? (
                          <Loader2 size={10} className="animate-spin" />
                        ) : (
                          <RotateCcw size={10} />
                        )}
                        Revert
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 dark:bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors disabled:opacity-50"
            >
              {isSaving && <Loader2 size={14} className="animate-spin" />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PresetEditModal;
