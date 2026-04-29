/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ClientProfileEditor.tsx - Modal editor for client workspace defaults.
 *
 * Captures client identity, brand notes, and default voice/provider/model
 * values used by project creation and render fallback workflows.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { X, Loader2, Building2 } from 'lucide-react';
import type { Client, CreateClientInput } from '../types';
import { VOICE_DATA } from '../constants';

interface ClientProfileEditorProps {
  /** If provided, we are editing an existing client. Otherwise, creating new. */
  client?: Client;
  onSave: (data: CreateClientInput) => Promise<void>;
  onClose: () => void;
  isDarkMode?: boolean;
}

/** Render the create/edit form for a client workspace profile. */
export default function ClientProfileEditor({
  client,
  onSave,
  onClose,
  isDarkMode,
}: ClientProfileEditorProps) {
  const isEdit = Boolean(client);

  const [name, setName] = useState(client?.name ?? '');
  const [description, setDescription] = useState(client?.description ?? '');
  const [brandNotes, setBrandNotes] = useState(client?.brand_notes ?? '');
  const [defaultVoiceName, setDefaultVoiceName] = useState(client?.default_voice_name ?? '');
  const [defaultProvider, setDefaultProvider] = useState(client?.default_provider ?? '');
  const [defaultModel, setDefaultModel] = useState(client?.default_model ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const firstFocusRef = useRef<HTMLInputElement>(null);

  // Focus first field on open
  useEffect(() => {
    firstFocusRef.current?.focus();
  }, []);

  // Focus trap
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key !== 'Tab') return;
    const modal = modalRef.current;
    if (!modal) return;
    const focusable = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => !el.hasAttribute('disabled'));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Client name is required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        brand_notes: brandNotes.trim(),
        default_voice_name: defaultVoiceName || undefined,
        default_provider: defaultProvider.trim() || undefined,
        default_model: defaultModel.trim() || undefined,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save client.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="client-editor-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        className="relative z-10 w-full max-w-lg rounded-2xl shadow-2xl
          bg-white dark:bg-zinc-900
          border border-zinc-200 dark:border-zinc-700
          flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-blue-500" />
            <h2 id="client-editor-title" className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
              {isEdit ? 'Edit Client' : 'New Client'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400 transition-colors"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-4">
          {/* Name */}
          <div className="flex flex-col gap-1">
            <label htmlFor="client-name" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={firstFocusRef}
              id="client-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700
                bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100
                px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              autoComplete="off"
            />
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label htmlFor="client-desc" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description
            </label>
            <input
              id="client-desc"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of this client"
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700
                bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100
                px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Brand Notes */}
          <div className="flex flex-col gap-1">
            <label htmlFor="client-brand-notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Brand Notes
            </label>
            <textarea
              id="client-brand-notes"
              rows={3}
              value={brandNotes}
              onChange={(e) => setBrandNotes(e.target.value)}
              placeholder="e.g. Always use a confident, professional tone. Avoid slang."
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700
                bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100
                px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
            />
          </div>

          {/* Default Voice */}
          <div className="flex flex-col gap-1">
            <label htmlFor="client-voice" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Default Voice
            </label>
            <select
              id="client-voice"
              value={defaultVoiceName}
              onChange={(e) => setDefaultVoiceName(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700
                bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100
                px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="">— None —</option>
              {VOICE_DATA.map((v) => (
                <option key={v.name} value={v.name}>
                  {v.name}
                </option>
              ))}
            </select>
          </div>

          {/* Provider / Model (advanced) */}
          <details className="group">
            <summary className="cursor-pointer text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 select-none list-none flex items-center gap-1">
              <span className="group-open:rotate-90 transition-transform inline-block">▶</span>
              Advanced defaults
            </summary>
            <div className="mt-3 flex flex-col gap-3 pl-4 border-l-2 border-zinc-100 dark:border-zinc-800">
              <div className="flex flex-col gap-1">
                <label htmlFor="client-provider" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Default Provider
                </label>
                <input
                  id="client-provider"
                  type="text"
                  value={defaultProvider}
                  onChange={(e) => setDefaultProvider(e.target.value)}
                  placeholder="e.g. google"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700
                    bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100
                    px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="client-model" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Default Model
                </label>
                <input
                  id="client-model"
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="e.g. gemini-2.5-pro-preview-tts"
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-700
                    bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100
                    px-3 py-2 text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>
          </details>

          {error && (
            <p className="text-sm text-red-500 dark:text-red-400" role="alert">{error}</p>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-zinc-100 dark:border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-medium
              text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form=""
            onClick={handleSubmit}
            disabled={saving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white transition-colors"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>
  );
}
