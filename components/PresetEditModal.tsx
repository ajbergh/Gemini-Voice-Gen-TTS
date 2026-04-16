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
import { X, Loader2 } from 'lucide-react';
import { CustomPreset } from '../types';

interface PresetEditModalProps {
  preset: CustomPreset;
  onSave: (id: number, data: { name?: string; system_instruction?: string }) => Promise<void>;
  onClose: () => void;
}

const PresetEditModal: React.FC<PresetEditModalProps> = ({ preset, onSave, onClose }) => {
  const [name, setName] = useState(preset.name);
  const [systemInstruction, setSystemInstruction] = useState(preset.system_instruction || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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
      await onSave(preset.id, {
        name: trimmedName !== preset.name ? trimmedName : undefined,
        system_instruction: systemInstruction !== preset.system_instruction ? systemInstruction : undefined,
      });
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Failed to update preset.';
      setError(msg.includes('UNIQUE') ? `A preset named "${trimmedName}" already exists.` : msg);
    } finally {
      setIsSaving(false);
    }
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
