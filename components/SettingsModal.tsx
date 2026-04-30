/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * SettingsModal.tsx — Production Settings Modal (Plan 14 Phase 1)
 *
 * Tab-based settings panel: Providers & Keys, Render Defaults, Storage & Cache,
 * and Appearance. Keys are encrypted with AES-256-GCM before storage.
 * Implements focus trap and Escape-to-close for accessibility.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X, Key, Eye, EyeOff, Check, AlertCircle, Loader2, Trash2, Shield,
  HardDrive, Download, Upload, Plus, RotateCcw, Cpu, Moon, Sun,
  Contrast, Save, FileOutput, BookOpen, ClipboardCheck,
} from 'lucide-react';
import {
  listApiKeys, storeApiKey, deleteApiKey, testApiKey, APIKeyInfo,
  getCacheStats, clearCache, CacheStats, createBackup, restoreBackup,
  listKeyPool, addKeyToPool, deleteKeyFromPool, resetPoolKey, APIKeyPoolEntry,
  CONFIG_KEYS, getConfig, updateConfig,
  listExportProfiles, createExportProfile, deleteExportProfile,
} from '../api';
import { ExportProfile } from '../types';
import BottomSheet from './BottomSheet';
import GlobalPronunciationSettings from './GlobalPronunciationSettings';
import QcRulesSettings from './QcRulesSettings';

// ── Types ──────────────────────────────────────────────────────────────────────

type SettingsTab = 'keys' | 'render' | 'storage' | 'appearance' | 'profiles' | 'dictionaries' | 'qc';

interface SettingsModalProps {
  onClose: () => void;
  isDarkMode: boolean;
  onToggleDark: () => void;
  accentColor: string;
  onAccentChange: (color: string) => void;
  highContrast: boolean;
  onHighContrastChange: (v: boolean) => void;
}

interface RenderDefaults {
  default_model: string;
  default_language_code: string;
  default_batch_concurrency: string;
  default_retry_count: string;
  continue_batch_on_error: string;
}

const DEFAULT_RENDER: RenderDefaults = {
  default_model: 'gemini-3.1-flash-tts-preview',
  default_language_code: 'en-US',
  default_batch_concurrency: '3',
  default_retry_count: '2',
  continue_batch_on_error: 'true',
};

const GEMINI_MODELS = [
  { value: 'gemini-3.1-flash-tts-preview', label: 'Gemini 3.1 Flash TTS (Default)' },
  { value: 'gemini-2.5-flash-preview-tts', label: 'Gemini 2.5 Flash TTS' },
];

const ACCENT_COLORS = [
  { value: 'indigo', label: 'Indigo', cls: 'bg-indigo-500' },
  { value: 'emerald', label: 'Emerald', cls: 'bg-emerald-500' },
  { value: 'violet', label: 'Violet', cls: 'bg-violet-500' },
  { value: 'sky', label: 'Sky', cls: 'bg-sky-500' },
  { value: 'rose', label: 'Rose', cls: 'bg-rose-500' },
  { value: 'amber', label: 'Amber', cls: 'bg-amber-500' },
];

// ── Component ──────────────────────────────────────────────────────────────────

const SettingsModal: React.FC<SettingsModalProps> = ({
  onClose,
  isDarkMode,
  onToggleDark,
  accentColor,
  onAccentChange,
  highContrast,
  onHighContrastChange,
}) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('keys');

  // ── Keys tab state ──
  const [keys, setKeys] = useState<APIKeyInfo[]>([]);
  const [newKey, setNewKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testResult, setTestResult] = useState<{ valid: boolean; message: string } | null>(null);
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [poolKeys, setPoolKeys] = useState<APIKeyPoolEntry[]>([]);
  const [showPool, setShowPool] = useState(false);
  const [newPoolKey, setNewPoolKey] = useState('');
  const [newPoolLabel, setNewPoolLabel] = useState('');
  const [addingPool, setAddingPool] = useState(false);

  // ── Render tab state ──
  const [renderDefaults, setRenderDefaults] = useState<RenderDefaults>(DEFAULT_RENDER);
  const [renderLoading, setRenderLoading] = useState(false);
  const [savingRender, setSavingRender] = useState(false);

  // ── Profiles tab state ──
  const [exportProfiles, setExportProfiles] = useState<ExportProfile[]>([]);
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [defaultProfileId, setDefaultProfileId] = useState<string>('');
  const [savingDefaultProfile, setSavingDefaultProfile] = useState(false);
  const [newProfileName, setNewProfileName] = useState('');
  const [creatingProfile, setCreatingProfile] = useState(false);

  // ── Shared feedback ──
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const modalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMountedRef = useRef(true);

  // Clear feedback when switching tabs
  useEffect(() => {
    setError(null);
    setSuccess(null);
    setTestResult(null);
  }, [activeTab]);

  useEffect(() => {
    isMountedRef.current = true;
    loadKeys();
    loadPool();
    loadCacheStats();
    loadRenderDefaults();
    loadExportProfiles();
    return () => { isMountedRef.current = false; };
  }, []);

  // Focus trap
  useEffect(() => {
    inputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab' || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, input, select, [tabindex]:not([tabindex="-1"])'
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) { last.focus(); e.preventDefault(); }
      } else {
        if (document.activeElement === last) { first.focus(); e.preventDefault(); }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // ── Data loaders ─────────────────────────────────────────────────────────────

  /** Load stored API key metadata from the backend. */
  const loadKeys = async () => {
    try {
      const data = await listApiKeys();
      if (isMountedRef.current) setKeys(data || []);
    } catch {
      if (isMountedRef.current) setError('Failed to load API keys.');
    }
  };

  const loadPool = async () => {
    try {
      const data = await listKeyPool('gemini');
      if (isMountedRef.current) setPoolKeys(data || []);
    } catch { /* ignore — pool may not exist yet */ }
  };

  const handleAddPoolKey = async () => {
    if (!newPoolKey.trim()) return;
    setAddingPool(true);
    setError(null);
    try {
      await addKeyToPool('gemini', newPoolKey.trim(), newPoolLabel.trim());
      if (isMountedRef.current) {
        setNewPoolKey('');
        setNewPoolLabel('');
        setSuccess('Key added to rotation pool.');
        loadPool();
      }
    } catch {
      if (isMountedRef.current) setError('Failed to add key to pool.');
    } finally {
      if (isMountedRef.current) setAddingPool(false);
    }
  };

  const handleDeletePoolKey = async (id: number) => {
    try {
      await deleteKeyFromPool('gemini', id);
      if (isMountedRef.current) {
        setSuccess('Key removed from pool.');
        loadPool();
      }
    } catch {
      if (isMountedRef.current) setError('Failed to remove key from pool.');
    }
  };

  const handleResetPoolKey = async (id: number) => {
    try {
      await resetPoolKey('gemini', id);
      if (isMountedRef.current) {
        setSuccess('Key errors reset.');
        loadPool();
      }
    } catch {
      if (isMountedRef.current) setError('Failed to reset key.');
    }
  };

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

  /** Load audio cache statistics from the backend. */
  const loadCacheStats = async () => {
    try {
      const stats = await getCacheStats();
      if (isMountedRef.current) setCacheStats(stats);
    } catch {}
  };

  /** Clear all cached audio files. */
  const handleClearCache = async () => {
    setClearingCache(true);
    try {
      await clearCache();
      if (isMountedRef.current) {
        await loadCacheStats();
        setSuccess('Audio cache cleared.');
      }
    } catch {
      if (isMountedRef.current) setError('Failed to clear audio cache.');
    } finally {
      if (isMountedRef.current) setClearingCache(false);
    }
  };

  // ── Render defaults handlers ──────────────────────────────────────────────────

  const loadRenderDefaults = async () => {
    setRenderLoading(true);
    try {
      const cfg = await getConfig();
      if (isMountedRef.current) {
        setRenderDefaults({
          default_model: cfg[CONFIG_KEYS.DEFAULT_MODEL] ?? DEFAULT_RENDER.default_model,
          default_language_code: cfg[CONFIG_KEYS.DEFAULT_LANGUAGE_CODE] ?? DEFAULT_RENDER.default_language_code,
          default_batch_concurrency: cfg[CONFIG_KEYS.DEFAULT_BATCH_CONCURRENCY] ?? DEFAULT_RENDER.default_batch_concurrency,
          default_retry_count: cfg[CONFIG_KEYS.DEFAULT_RETRY_COUNT] ?? DEFAULT_RENDER.default_retry_count,
          continue_batch_on_error: cfg[CONFIG_KEYS.CONTINUE_BATCH_ON_ERROR] ?? DEFAULT_RENDER.continue_batch_on_error,
        });
      }
    } catch {
      if (isMountedRef.current) setRenderDefaults(DEFAULT_RENDER);
    } finally {
      if (isMountedRef.current) setRenderLoading(false);
    }
  };

  const handleSaveRender = async () => {
    setSavingRender(true); setError(null); setSuccess(null);
    try {
      await updateConfig(renderDefaults as unknown as Record<string, string>);
      if (isMountedRef.current) setSuccess('Render defaults saved.');
    } catch {
      if (isMountedRef.current) setError('Failed to save render defaults.');
    } finally {
      if (isMountedRef.current) setSavingRender(false);
    }
  };

  // ── Export Profiles handlers ───────────────────────────────────────────────

  const loadExportProfiles = async () => {
    setProfilesLoading(true);
    try {
      const [profiles, cfg] = await Promise.all([listExportProfiles(), getConfig()]);
      if (isMountedRef.current) {
        setExportProfiles(profiles ?? []);
        setDefaultProfileId(cfg[CONFIG_KEYS.DEFAULT_EXPORT_PROFILE_ID] ?? '');
      }
    } catch {
      /* non-fatal */
    } finally {
      if (isMountedRef.current) setProfilesLoading(false);
    }
  };

  const handleSaveDefaultProfile = async (id: string) => {
    setDefaultProfileId(id);
    setSavingDefaultProfile(true);
    try {
      await updateConfig({ [CONFIG_KEYS.DEFAULT_EXPORT_PROFILE_ID]: id });
      if (isMountedRef.current) setSuccess('Default export profile saved.');
    } catch {
      if (isMountedRef.current) setError('Failed to save default profile.');
    } finally {
      if (isMountedRef.current) setSavingDefaultProfile(false);
    }
  };

  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) return;
    setCreatingProfile(true); setError(null);
    try {
      const created = await createExportProfile({
        name: newProfileName.trim(),
        target_kind: 'custom',
        trim_silence: false,
        silence_threshold_db: -50,
        leading_silence_ms: 0,
        trailing_silence_ms: 0,
        inter_segment_silence_ms: 500,
        normalize_peak_db: -3,
      });
      if (isMountedRef.current) {
        setNewProfileName('');
        setExportProfiles(prev => [...prev, created]);
        setSuccess(`Profile "${created.name}" created.`);
      }
    } catch {
      if (isMountedRef.current) setError('Failed to create profile.');
    } finally {
      if (isMountedRef.current) setCreatingProfile(false);
    }
  };

  const handleDeleteProfile = async (profile: ExportProfile) => {
    if (profile.is_builtin) return;
    try {
      await deleteExportProfile(profile.id);
      if (isMountedRef.current) {
        setExportProfiles(prev => prev.filter(p => p.id !== profile.id));
        if (defaultProfileId === String(profile.id)) {
          setDefaultProfileId('');
          await updateConfig({ [CONFIG_KEYS.DEFAULT_EXPORT_PROFILE_ID]: '' });
        }
        setSuccess(`Profile "${profile.name}" deleted.`);
      }
    } catch {
      if (isMountedRef.current) setError('Failed to delete profile.');
    }
  };

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
  };

  const hasGeminiKey = keys.some(k => k.provider === 'gemini');

  // ── Tab renderers ─────────────────────────────────────────────────────────────

  const renderKeysTab = () => (
    <div className="space-y-0">
      {/* Status banner */}
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

      {/* Key actions */}
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

      {testResult && (
        <div className={`flex items-center gap-2 p-3 rounded-xl text-sm mb-4 ${testResult.valid ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
          {testResult.valid ? <Check size={16} className="flex-shrink-0" /> : <AlertCircle size={16} className="flex-shrink-0" />}
          {testResult.message}
        </div>
      )}

      <p className="text-xs text-zinc-400 dark:text-zinc-500 text-center mb-6">
        Get your key from{' '}
        <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-emerald-600 dark:text-emerald-400 hover:underline">
          Google AI Studio
        </a>. Encrypted with AES-256-GCM before storage.
      </p>

      {/* Key Rotation Pool */}
      <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setShowPool(!showPool)}
          className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 mb-3 w-full text-left"
        >
          <Key size={16} />
          <span className="text-sm font-medium">Key Rotation Pool</span>
          <span className="text-xs text-zinc-400 ml-auto">{poolKeys.length} key{poolKeys.length !== 1 ? 's' : ''}</span>
        </button>

        {showPool && (
          <div className="space-y-3">
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Add multiple API keys for automatic round-robin rotation. Keys are auto-disabled after 5 consecutive errors.
            </p>
            {poolKeys.length > 0 && (
              <div className="space-y-2">
                {poolKeys.map(pk => (
                  <div key={pk.id} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`inline-block w-2 h-2 rounded-full ${pk.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                        <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{pk.label || `Key #${pk.id}`}</span>
                      </div>
                      {pk.error_count > 0 && <p className="text-xs text-red-400 mt-0.5">{pk.error_count} error{pk.error_count !== 1 ? 's' : ''}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {!pk.is_active && (
                        <button onClick={() => handleResetPoolKey(pk.id)} className="p-1.5 text-zinc-400 hover:text-emerald-500 transition-colors" title="Reset & reactivate">
                          <RotateCcw size={12} />
                        </button>
                      )}
                      <button onClick={() => handleDeletePoolKey(pk.id)} className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors" title="Remove key">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <input
                type="text"
                value={newPoolLabel}
                onChange={e => setNewPoolLabel(e.target.value)}
                placeholder="Label (optional)"
                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400"
              />
              <div className="flex gap-2">
                <input
                  type="password"
                  value={newPoolKey}
                  onChange={e => setNewPoolKey(e.target.value)}
                  placeholder="API key"
                  className="flex-1 px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder:text-zinc-400"
                />
                <button
                  onClick={handleAddPoolKey}
                  disabled={addingPool || !newPoolKey.trim()}
                  className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl transition-colors"
                >
                  {addingPool ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  Add
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderRenderTab = () => (
    <div className="space-y-5">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        These defaults apply when a project or segment does not specify its own overrides.
      </p>

      {renderLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 size={20} className="animate-spin text-zinc-400" />
        </div>
      ) : (
        <>
          {/* Default Model */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Default TTS Model</label>
            <select
              value={renderDefaults.default_model}
              onChange={e => setRenderDefaults(p => ({ ...p, default_model: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
            >
              {GEMINI_MODELS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Default Language */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Default Language Code</label>
            <input
              type="text"
              value={renderDefaults.default_language_code}
              onChange={e => setRenderDefaults(p => ({ ...p, default_language_code: e.target.value }))}
              placeholder="e.g. en-US, fr-FR, ja-JP"
              className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm font-mono"
            />
            <p className="text-xs text-zinc-400 dark:text-zinc-500">BCP-47 language tag. Leave as en-US for English.</p>
          </div>

          {/* Batch Concurrency */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Batch Concurrency
              <span className="ml-2 text-xs font-normal text-zinc-400">{renderDefaults.default_batch_concurrency} parallel renders</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={renderDefaults.default_batch_concurrency}
              onChange={e => setRenderDefaults(p => ({ ...p, default_batch_concurrency: e.target.value }))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-zinc-400">
              <span>1 (sequential)</span>
              <span>10 (max)</span>
            </div>
          </div>

          {/* Retry Count */}
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Retry Count
              <span className="ml-2 text-xs font-normal text-zinc-400">{renderDefaults.default_retry_count} retries on failure</span>
            </label>
            <input
              type="range"
              min={0}
              max={5}
              value={renderDefaults.default_retry_count}
              onChange={e => setRenderDefaults(p => ({ ...p, default_retry_count: e.target.value }))}
              className="w-full accent-emerald-500"
            />
            <div className="flex justify-between text-xs text-zinc-400">
              <span>0 (no retry)</span>
              <span>5</span>
            </div>
          </div>

          {/* Continue on Error */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">Continue Batch on Error</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Skip failed segments instead of stopping the whole batch.</p>
            </div>
            <button
              role="switch"
              aria-checked={renderDefaults.continue_batch_on_error === 'true'}
              onClick={() => setRenderDefaults(p => ({ ...p, continue_batch_on_error: p.continue_batch_on_error === 'true' ? 'false' : 'true' }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${renderDefaults.continue_batch_on_error === 'true' ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${renderDefaults.continue_batch_on_error === 'true' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          <button
            onClick={handleSaveRender}
            disabled={savingRender}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-300 dark:disabled:bg-zinc-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            {savingRender ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            Save Render Defaults
          </button>
        </>
      )}
    </div>
  );

  const renderStorageTab = () => (
    <div className="space-y-6">
      {/* Audio Cache */}
      <div>
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 mb-3">
          <HardDrive size={16} />
          <span className="text-sm font-medium">Audio Cache</span>
        </div>
        {cacheStats ? (
          <div className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-100 dark:border-zinc-800">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">{formatBytes(cacheStats.total_size)}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{cacheStats.file_count} cached {cacheStats.file_count === 1 ? 'file' : 'files'}</p>
            </div>
            {cacheStats.file_count > 0 && (
              <button
                onClick={handleClearCache}
                disabled={clearingCache}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              >
                {clearingCache ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                Clear Cache
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={14} className="animate-spin text-zinc-400" />
          </div>
        )}
      </div>

      {/* Backup & Restore */}
      <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300 mb-3">
          <Download size={16} />
          <span className="text-sm font-medium">Backup & Restore</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={async () => {
              setBackingUp(true); setError(null);
              try {
                await createBackup();
                if (isMountedRef.current) setSuccess('Backup downloaded.');
              } catch {
                if (isMountedRef.current) setError('Failed to create backup.');
              } finally {
                if (isMountedRef.current) setBackingUp(false);
              }
            }}
            disabled={backingUp}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
          >
            {backingUp ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
            Download Backup
          </button>
          <button
            onClick={() => restoreInputRef.current?.click()}
            disabled={restoring}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors"
          >
            {restoring ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            Restore Backup
          </button>
          <input
            ref={restoreInputRef}
            type="file"
            accept=".db"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setRestoring(true); setError(null);
              try {
                await restoreBackup(file);
                if (isMountedRef.current) {
                  setSuccess('Database restored. Reloading...');
                  setTimeout(() => window.location.reload(), 1500);
                }
              } catch {
                if (isMountedRef.current) setError('Failed to restore backup.');
              } finally {
                if (isMountedRef.current) setRestoring(false);
                e.target.value = '';
              }
            }}
          />
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
          Backup includes all settings, history, presets, and project data.
        </p>
      </div>
    </div>
  );

  const renderAppearanceTab = () => (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Theme</p>
        <div className="flex gap-3">
          <button
            onClick={() => { if (isDarkMode) onToggleDark(); }}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${!isDarkMode ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`}
            aria-pressed={!isDarkMode}
          >
            <Sun size={20} className={!isDarkMode ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'} />
            <span className={`text-xs font-medium ${!isDarkMode ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500'}`}>Light</span>
          </button>
          <button
            onClick={() => { if (!isDarkMode) onToggleDark(); }}
            className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${isDarkMode ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600'}`}
            aria-pressed={isDarkMode}
          >
            <Moon size={20} className={isDarkMode ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-400'} />
            <span className={`text-xs font-medium ${isDarkMode ? 'text-emerald-700 dark:text-emerald-400' : 'text-zinc-500'}`}>Dark</span>
          </button>
        </div>
      </div>

      {/* Accent Color */}
      <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-3">Accent Color</p>
        <div className="flex flex-wrap gap-3">
          {ACCENT_COLORS.map(c => (
            <button
              key={c.value}
              onClick={() => onAccentChange(c.value)}
              title={c.label}
              className={`h-9 w-9 rounded-full ${c.cls} transition-all ${accentColor === c.value ? 'ring-2 ring-offset-2 ring-zinc-900 dark:ring-white scale-110' : 'opacity-70 hover:opacity-100 hover:scale-105'}`}
              aria-label={`${c.label} accent`}
              aria-pressed={accentColor === c.value}
            />
          ))}
        </div>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">Accent color affects navigation highlights and active states.</p>
      </div>

      {/* High Contrast */}
      <div className="pt-5 border-t border-zinc-200 dark:border-zinc-800">
        <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <Contrast size={18} className="text-zinc-500 dark:text-zinc-400" />
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">High Contrast</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Increase contrast for improved accessibility.</p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={highContrast}
            onClick={() => onHighContrastChange(!highContrast)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 ${highContrast ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-600'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${highContrast ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </div>
    </div>
  );

  // ── Profiles tab renderer ─────────────────────────────────────────────────────

  const renderProfilesTab = () => (
    <div className="space-y-6">
      {/* Default export profile */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Default Export Profile</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Applied automatically when exporting a project without an explicit profile selection.</p>
        </div>
        {profilesLoading ? (
          <div className="flex items-center gap-2 text-zinc-500 dark:text-zinc-400 text-sm py-2">
            <Loader2 size={15} className="animate-spin" /> Loading profiles…
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <select
              value={defaultProfileId}
              onChange={e => handleSaveDefaultProfile(e.target.value)}
              disabled={savingDefaultProfile}
              className="flex-1 text-sm px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">— No default (manual selection) —</option>
              {exportProfiles.filter(p => p.is_builtin).length > 0 && (
                <optgroup label="Built-in profiles">
                  {exportProfiles.filter(p => p.is_builtin).map(p => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </optgroup>
              )}
              {exportProfiles.filter(p => !p.is_builtin).length > 0 && (
                <optgroup label="Custom profiles">
                  {exportProfiles.filter(p => !p.is_builtin).map(p => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
            {savingDefaultProfile && <Loader2 size={15} className="animate-spin text-emerald-500" />}
          </div>
        )}
      </div>

      {/* Profile list */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">All Profiles</h3>
        <div className="space-y-2">
          {exportProfiles.map(profile => (
            <div
              key={profile.id}
              className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-zinc-900 dark:text-white truncate">{profile.name}</span>
                  {profile.is_builtin && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-400 font-semibold uppercase tracking-wide flex-shrink-0">Built-in</span>
                  )}
                  {String(profile.id) === defaultProfileId && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 font-semibold uppercase tracking-wide flex-shrink-0">Default</span>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">
                  Norm: {profile.normalize_peak_db} dBFS · Inter-segment: {profile.inter_segment_silence_ms} ms
                  {profile.trim_silence ? ' · Trim silence' : ''}
                </p>
              </div>
              {!profile.is_builtin && (
                <button
                  onClick={() => handleDeleteProfile(profile)}
                  className="p-1.5 rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex-shrink-0"
                  aria-label={`Delete ${profile.name}`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
          {exportProfiles.length === 0 && !profilesLoading && (
            <p className="text-sm text-zinc-500 dark:text-zinc-400 py-2 text-center">No profiles found.</p>
          )}
        </div>
      </div>

      {/* Create custom profile */}
      <div className="space-y-3 pt-1 border-t border-zinc-100 dark:border-zinc-800">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">New Custom Profile</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">Creates a profile with default audio settings. Edit individual values later via the Export dialog.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={newProfileName}
            onChange={e => setNewProfileName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateProfile(); }}
            placeholder="Profile name…"
            className="flex-1 text-sm px-3 py-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={handleCreateProfile}
            disabled={creatingProfile || !newProfileName.trim()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white text-sm font-medium transition-colors"
          >
            {creatingProfile ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Create
          </button>
        </div>
      </div>
    </div>
  );

  // ── Tab definitions ───────────────────────────────────────────────────────────

  const TABS: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'keys',       label: 'Keys',       icon: <Key size={14} /> },
    { id: 'render',     label: 'Render',     icon: <Cpu size={14} /> },
    { id: 'profiles',   label: 'Export',     icon: <FileOutput size={14} /> },
    { id: 'dictionaries', label: 'Dicts',     icon: <BookOpen size={14} /> },
    { id: 'qc',         label: 'QC',         icon: <ClipboardCheck size={14} /> },
    { id: 'storage',    label: 'Storage',    icon: <HardDrive size={14} /> },
    { id: 'appearance', label: 'Appearance', icon: <Sun size={14} /> },
  ];

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <BottomSheet onClose={onClose} ariaLabel="Settings">
      <div
        ref={modalRef}
        className="relative w-full max-w-xl mx-auto bg-white dark:bg-zinc-900 sm:rounded-3xl shadow-2xl overflow-hidden sm:animate-slide-up ring-1 ring-zinc-900/5"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        {/* Gradient header decoration */}
        <div className="absolute top-0 inset-x-0 h-24 bg-gradient-to-b from-emerald-50/50 to-white/0 dark:from-emerald-900/20 dark:to-zinc-900/0 pointer-events-none" />

        <div className="relative p-6 sm:p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-1">
                <Shield size={17} />
                <span className="text-xs font-bold tracking-wider uppercase">Settings</span>
              </div>
              <h2 id="settings-title" className="text-2xl font-serif font-medium tracking-tight text-zinc-900 dark:text-white">
                Production Settings
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Providers, render defaults, export, dictionaries, QC, storage, and appearance.</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-2xl mb-6 overflow-x-auto" role="tablist">
            {TABS.map(tab => (
              <button
                key={tab.id}
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`min-w-11 sm:min-w-0 sm:flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm'
                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Feedback messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 text-sm mb-4">
              <AlertCircle size={16} className="flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 text-sm mb-4">
              <Check size={16} className="flex-shrink-0" />
              {success}
            </div>
          )}

          {/* Tab content */}
          <div role="tabpanel" className="overflow-y-auto max-h-[60vh] pr-1">
            {activeTab === 'keys' && renderKeysTab()}
            {activeTab === 'render' && renderRenderTab()}
            {activeTab === 'profiles' && renderProfilesTab()}
            {activeTab === 'dictionaries' && <GlobalPronunciationSettings />}
            {activeTab === 'qc' && <QcRulesSettings />}
            {activeTab === 'storage' && renderStorageTab()}
            {activeTab === 'appearance' && renderAppearanceTab()}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
};

export default SettingsModal;
