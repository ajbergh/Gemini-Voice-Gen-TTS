/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SettingsModal.tsx — API Key Management Modal
 *
 * Provides a UI for saving, testing, and deleting the Gemini API key. The key
 * is sent to the Go backend which encrypts it with AES-256-GCM before storing
 * in SQLite. Supports show/hide toggle for the key input, validation against
 * the live Gemini API via /api/keys/:provider/test, and visual status feedback.
 * Implements focus trap and Escape-to-close for accessibility.
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Key, Eye, EyeOff, Check, AlertCircle, Loader2, Trash2, Shield } from 'lucide-react';
import { listApiKeys, storeApiKey, deleteApiKey, testApiKey, APIKeyInfo } from '../api';

interface SettingsModalProps {
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ onClose }) => {
  const [keys, setKeys] = useState<APIKeyInfo[]>([]);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadKeys();
    return () => { isMountedRef.current = false; };
  }, []);

  // Focus trap
  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll(
        'button, input, [tabindex]:not([tabindex="-1"])'
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

  /** Load stored API key metadata from the backend. */
  const loadKeys = async () => {
    try {
      const data = await listApiKeys();
      if (isMountedRef.current) setKeys(data || []);
    } catch {
      if (isMountedRef.current) setError('Failed to load API keys.');
    }
  };

  const hasGeminiKey = keys.some(k => k.provider === 'gemini');

  /** Save the entered API key to the backend (encrypted at rest with AES-256-GCM). */
  const handleSave = async () => {
    if (!newKey.trim()) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);
    try {
      await storeApiKey('gemini', newKey.trim());
      if (isMountedRef.current) {
        setNewKey('');
        setSuccess('API key saved and encrypted.');
        await loadKeys();
      }
    } catch (err: any) {
      if (isMountedRef.current) setError(err.message || 'Failed to save key.');
    } finally {
      if (isMountedRef.current) setSaving(false);
    }
  };

  /** Validate the stored key by making a lightweight call to the Gemini API. */
  const handleTest = async () => {
    setTesting(true);
    setError(null);
    setTestResult(null);
    try {
      const result = await testApiKey('gemini');
      if (isMountedRef.current) setTestResult(result);
    } catch (err: any) {
      if (isMountedRef.current) setTestResult({ valid: false, message: err.message || 'Test failed.' });
    } finally {
      if (isMountedRef.current) setTesting(false);
    }
  };

  /** Remove the stored API key from the backend database. */
  const handleDelete = async () => {
    setDeleting(true);
    setError(null);
    setSuccess(null);
    setTestResult(null);
    try {
      await deleteApiKey('gemini');
      if (isMountedRef.current) {
        setSuccess('API key removed.');
        await loadKeys();
      }
    } catch (err: any) {
      if (isMountedRef.current) setError(err.message || 'Failed to delete key.');
    } finally {
      if (isMountedRef.current) setDeleting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-zinc-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose}></div>

      {/* Modal */}
      <div ref={modalRef} className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden animate-slide-up ring-1 ring-zinc-900/5">
        {/* Header */}
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-emerald-50/50 to-white/0 dark:from-emerald-900/20 dark:to-zinc-900/0 pointer-events-none"></div>

        <div className="relative p-8">
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <Shield size={18} />
                <span className="text-sm font-bold tracking-wider uppercase">Settings</span>
              </div>
              <h2 id="settings-title" className="text-2xl font-serif font-medium tracking-tight text-zinc-900 dark:text-white">API Key Management</h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Your key is encrypted and stored locally.</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Status */}
          <div className={`flex items-center gap-3 p-4 rounded-2xl mb-6 ${hasGeminiKey ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800'}`}>
            <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${hasGeminiKey ? 'bg-emerald-100 dark:bg-emerald-800' : 'bg-amber-100 dark:bg-amber-800'}`}>
              {hasGeminiKey ? <Check size={16} className="text-emerald-600 dark:text-emerald-400" /> : <Key size={16} className="text-amber-600 dark:text-amber-400" />}
            </div>
            <div>
              <p className={`text-sm font-medium ${hasGeminiKey ? 'text-emerald-800 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300'}`}>
                {hasGeminiKey ? 'Gemini API key configured' : 'No API key configured'}
              </p>
              {hasGeminiKey && keys[0]?.updated_at && (
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 mt-0.5">
                  Last updated: {new Date(keys.find(k => k.provider === 'gemini')!.updated_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>

          {/* Input */}
          <div className="space-y-3 mb-4">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {hasGeminiKey ? 'Replace API Key' : 'Gemini API Key'}
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type={showKey ? 'text' : 'password'}
                value={newKey}
                onChange={(e) => setNewKey(e.target.value)}
                placeholder="AIza..."
                className="w-full px-4 py-3 pr-12 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm font-mono"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              />
              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                aria-label={showKey ? 'Hide key' : 'Show key'}
                type="button"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleSave}
              disabled={saving || !newKey.trim()}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Key size={16} />}
              {hasGeminiKey ? 'Update Key' : 'Save Key'}
            </button>
            {hasGeminiKey && (
              <>
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-xl text-sm font-medium transition-colors"
                >
                  {testing ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Test
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 text-red-600 dark:text-red-400 rounded-xl text-sm font-medium transition-colors"
                >
                  {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                </button>
              </>
            )}
          </div>

          {/* Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm mb-3">
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm mb-3">
              <Check size={16} className="flex-shrink-0" />
              {success}
            </div>
          )}
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-xl text-sm mb-3 ${testResult.valid ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
              {testResult.valid ? <Check size={16} className="flex-shrink-0" /> : <AlertCircle size={16} className="flex-shrink-0" />}
              {testResult.message}
            </div>
          )}

          {/* Info */}
          <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center">
            Get your API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">Google AI Studio</a>.
            Keys are encrypted with AES-256-GCM before storage.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
