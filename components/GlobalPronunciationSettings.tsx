/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BookOpen, Check, Loader2, Pencil, Plus, ToggleLeft, ToggleRight, Trash2, X } from 'lucide-react';
import {
  createGlobalDictionary,
  createGlobalEntry,
  deleteGlobalDictionary,
  deleteGlobalEntry,
  listGlobalDictionaries,
  listGlobalEntries,
  previewGlobalDictionary,
  updateGlobalDictionary,
  updateGlobalEntry,
} from '../api';
import { PronunciationDictionary, PronunciationEntry } from '../types';

export default function GlobalPronunciationSettings() {
  const isMounted = useRef(true);
  const [dicts, setDicts] = useState<PronunciationDictionary[]>([]);
  const [selectedDictId, setSelectedDictId] = useState<number | null>(null);
  const [entries, setEntries] = useState<PronunciationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [newDictName, setNewDictName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [newRaw, setNewRaw] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [newRegex, setNewRegex] = useState(false);
  const [previewText, setPreviewText] = useState('');
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { isMounted.current = false; }, []);

  const loadDicts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listGlobalDictionaries();
      if (!isMounted.current) return;
      setDicts(data);
      setSelectedDictId(prev => prev ?? data[0]?.id ?? null);
    } catch {
      if (isMounted.current) setError('Failed to load global dictionaries.');
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  const loadEntries = useCallback(async (dictId: number) => {
    setLoadingEntries(true);
    setPreviewResult(null);
    try {
      const data = await listGlobalEntries(dictId);
      if (isMounted.current) setEntries(data);
    } catch {
      if (isMounted.current) setError('Failed to load dictionary entries.');
    } finally {
      if (isMounted.current) setLoadingEntries(false);
    }
  }, []);

  useEffect(() => { loadDicts(); }, [loadDicts]);
  useEffect(() => {
    if (selectedDictId != null) loadEntries(selectedDictId);
    else setEntries([]);
  }, [selectedDictId, loadEntries]);

  const handleCreateDict = async () => {
    const name = newDictName.trim() || 'Global Dictionary';
    try {
      const created = await createGlobalDictionary(name);
      if (!isMounted.current) return;
      setDicts(prev => [...prev, created]);
      setSelectedDictId(created.id);
      setNewDictName('');
      setMessage(`Created "${created.name}".`);
    } catch {
      setError('Failed to create dictionary.');
    }
  };

  const handleRename = async (dictId: number) => {
    const name = renameValue.trim();
    if (!name) return;
    try {
      const updated = await updateGlobalDictionary(dictId, name);
      if (!isMounted.current) return;
      setDicts(prev => prev.map(d => d.id === dictId ? updated : d));
      setRenamingId(null);
      setMessage('Dictionary renamed.');
    } catch {
      setError('Failed to rename dictionary.');
    }
  };

  const handleDeleteDict = async (dictId: number) => {
    try {
      await deleteGlobalDictionary(dictId);
      if (!isMounted.current) return;
      const next = dicts.filter(d => d.id !== dictId);
      setDicts(next);
      setSelectedDictId(prev => prev === dictId ? next[0]?.id ?? null : prev);
      setMessage('Dictionary deleted.');
    } catch {
      setError('Failed to delete dictionary.');
    }
  };

  const handleCreateEntry = async () => {
    if (!selectedDictId || !newRaw.trim()) return;
    try {
      const entry = await createGlobalEntry(selectedDictId, {
        raw_word: newRaw.trim(),
        replacement: newReplacement.trim(),
        is_regex: newRegex,
        enabled: true,
      });
      if (!isMounted.current) return;
      setEntries(prev => [...prev, entry]);
      setNewRaw('');
      setNewReplacement('');
      setNewRegex(false);
      setPreviewResult(null);
    } catch {
      setError('Failed to add rule.');
    }
  };

  const handleToggleEntry = async (entry: PronunciationEntry) => {
    if (!selectedDictId) return;
    try {
      const updated = await updateGlobalEntry(selectedDictId, entry.id, { ...entry, enabled: !entry.enabled });
      if (!isMounted.current) return;
      setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
      setPreviewResult(null);
    } catch {
      setError('Failed to update rule.');
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!selectedDictId) return;
    try {
      await deleteGlobalEntry(selectedDictId, entryId);
      if (!isMounted.current) return;
      setEntries(prev => prev.filter(e => e.id !== entryId));
      setPreviewResult(null);
    } catch {
      setError('Failed to delete rule.');
    }
  };

  const handlePreview = async () => {
    if (!selectedDictId || !previewText.trim()) return;
    try {
      const result = await previewGlobalDictionary(selectedDictId, previewText);
      if (!isMounted.current) return;
      setPreviewResult(`${result.changed} rule${result.changed === 1 ? '' : 's'} applied: ${result.result}`);
    } catch {
      setError('Preview failed.');
    }
  };

  const selectedDict = dicts.find(d => d.id === selectedDictId) ?? null;

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Global Pronunciation Dictionaries</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
          Enabled global rules run before project-specific dictionaries during rendering.
        </p>
      </div>

      {error && <p className="rounded-xl bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs text-red-700 dark:text-red-300">{error}</p>}
      {message && <p className="rounded-xl bg-emerald-50 dark:bg-emerald-900/20 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">{message}</p>}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Loader2 size={15} className="animate-spin" /> Loading dictionaries...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[210px_1fr] gap-4">
          <div className="space-y-2">
            {dicts.map(dict => (
              <div key={dict.id} className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${selectedDictId === dict.id ? 'bg-[var(--accent-50)] dark:bg-zinc-800' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}>
                {renamingId === dict.id ? (
                  <form className="flex min-w-0 flex-1 gap-1" onSubmit={e => { e.preventDefault(); handleRename(dict.id); }}>
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      className="min-w-0 flex-1 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 py-1 text-xs"
                    />
                    <button type="submit" className="text-emerald-600" aria-label="Save name"><Check size={13} /></button>
                    <button type="button" onClick={() => setRenamingId(null)} className="text-zinc-400" aria-label="Cancel rename"><X size={13} /></button>
                  </form>
                ) : (
                  <>
                    <button type="button" onClick={() => setSelectedDictId(dict.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                      <BookOpen size={13} className="shrink-0 text-[var(--accent-500)]" />
                      <span className="truncate text-xs font-medium text-zinc-700 dark:text-zinc-200">{dict.name}</span>
                    </button>
                    <button type="button" onClick={() => { setRenamingId(dict.id); setRenameValue(dict.name); }} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" aria-label={`Rename ${dict.name}`}>
                      <Pencil size={12} />
                    </button>
                    <button type="button" onClick={() => handleDeleteDict(dict.id)} className="text-zinc-400 hover:text-red-500" aria-label={`Delete ${dict.name}`}>
                      <Trash2 size={12} />
                    </button>
                  </>
                )}
              </div>
            ))}

            <form className="flex gap-2 pt-2" onSubmit={e => { e.preventDefault(); handleCreateDict(); }}>
              <input
                value={newDictName}
                onChange={e => setNewDictName(e.target.value)}
                placeholder="New dictionary"
                className="min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 px-2 py-1.5 text-xs"
              />
              <button type="submit" className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] text-white" aria-label="Create dictionary">
                <Plus size={13} />
              </button>
            </form>
          </div>

          <div className="min-w-0 space-y-3">
            {!selectedDict ? (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">Create or select a global dictionary.</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Rules in {selectedDict.name}</p>
                  {loadingEntries && <Loader2 size={13} className="animate-spin text-zinc-400" />}
                </div>

                <div className="space-y-1">
                  {entries.map(entry => (
                    <div key={entry.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2">
                      <button type="button" onClick={() => handleToggleEntry(entry)} className="shrink-0 text-zinc-400 hover:text-[var(--accent-500)]" aria-label={entry.enabled ? 'Disable rule' : 'Enable rule'}>
                        {entry.enabled ? <ToggleRight size={16} className="text-[var(--accent-500)]" /> : <ToggleLeft size={16} />}
                      </button>
                      <code className={`min-w-0 flex-1 truncate text-xs ${entry.enabled ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-400 line-through'}`}>{entry.raw_word}</code>
                      <span className="text-xs text-zinc-400">-&gt;</span>
                      <code className={`min-w-0 flex-1 truncate text-xs ${entry.enabled ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-400 line-through'}`}>{entry.replacement}</code>
                      {entry.is_regex && <span className="rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500">regex</span>}
                      <button type="button" onClick={() => handleDeleteEntry(entry.id)} className="text-zinc-400 hover:text-red-500" aria-label="Delete rule">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                  {entries.length === 0 && !loadingEntries && <p className="py-2 text-xs text-zinc-400 dark:text-zinc-500">No rules yet.</p>}
                </div>

                <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Add Rule</p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input value={newRaw} onChange={e => setNewRaw(e.target.value)} placeholder="Word or pattern" className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 text-xs" />
                    <input value={newReplacement} onChange={e => setNewReplacement(e.target.value)} placeholder="Replacement" className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 text-xs" />
                    <label className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                      <input type="checkbox" checked={newRegex} onChange={e => setNewRegex(e.target.checked)} className="h-3 w-3 accent-[var(--accent-500)]" />
                      Regex
                    </label>
                    <button type="button" onClick={handleCreateEntry} disabled={!newRaw.trim()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-3 text-xs font-semibold text-white disabled:opacity-50">
                      <Plus size={12} /> Add
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Preview</p>
                  <div className="flex gap-2">
                    <input value={previewText} onChange={e => { setPreviewText(e.target.value); setPreviewResult(null); }} placeholder="Sample text" className="h-8 min-w-0 flex-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-2 text-xs" />
                    <button type="button" onClick={handlePreview} disabled={!previewText.trim()} className="inline-flex h-8 items-center rounded-lg border border-zinc-200 dark:border-zinc-700 px-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300 disabled:opacity-50">
                      Preview
                    </button>
                  </div>
                  {previewResult && <p className="rounded-lg bg-zinc-50 dark:bg-zinc-800 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-200">{previewResult}</p>}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
