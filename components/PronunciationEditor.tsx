/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PronunciationEditor.tsx — Project-scoped pronunciation dictionary editor.
 *
 * Shows a list of dictionaries for the project.  When a dictionary is selected,
 * its entries are displayed in a table with inline add/edit/delete controls.
 * A preview panel applies the dictionary to sample text in real time.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronRight,
  Loader2,
  Pencil,
  Plus,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X,
} from 'lucide-react';
import {
  createDictionary,
  createEntry,
  deleteDictionary,
  deleteEntry,
  listDictionaries,
  listEntries,
  previewDictionary,
  updateDictionary,
  updateEntry,
} from '../api';
import { PronunciationDictionary, PronunciationEntry } from '../types';
import { useToast } from './ToastProvider';

interface PronunciationEditorProps {
  projectId: number;
  onClose: () => void;
}

/** Render project-scoped pronunciation dictionary and entry management. */
const PronunciationEditor: React.FC<PronunciationEditorProps> = ({ projectId, onClose }) => {
  const { showToast } = useToast();
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // ---- dictionaries ----
  const [dicts, setDicts] = useState<PronunciationDictionary[]>([]);
  const [loadingDicts, setLoadingDicts] = useState(true);
  const [selectedDictId, setSelectedDictId] = useState<number | null>(null);

  // ---- dict rename ----
  const [renamingDictId, setRenamingDictId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [savingRename, setSavingRename] = useState(false);

  // ---- new dict ----
  const [showNewDict, setShowNewDict] = useState(false);
  const [newDictName, setNewDictName] = useState('');
  const [creatingDict, setCreatingDict] = useState(false);

  // ---- entries ----
  const [entries, setEntries] = useState<PronunciationEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);

  // ---- new entry form ----
  const [showNewEntry, setShowNewEntry] = useState(false);
  const [newRaw, setNewRaw] = useState('');
  const [newReplacement, setNewReplacement] = useState('');
  const [newIsRegex, setNewIsRegex] = useState(false);
  const [savingEntry, setSavingEntry] = useState(false);

  // ---- edit entry ----
  const [editingEntryId, setEditingEntryId] = useState<number | null>(null);
  const [editRaw, setEditRaw] = useState('');
  const [editReplacement, setEditReplacement] = useState('');
  const [editIsRegex, setEditIsRegex] = useState(false);
  const [savingEditEntry, setSavingEditEntry] = useState(false);

  // ---- preview ----
  const [previewText, setPreviewText] = useState('');
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewChanged, setPreviewChanged] = useState(0);
  const [previewing, setPreviewing] = useState(false);

  // ---------------------------------------------------------------------------
  // Load dictionaries
  // ---------------------------------------------------------------------------
  const loadDicts = useCallback(async () => {
    setLoadingDicts(true);
    try {
      const data = await listDictionaries(projectId);
      if (!isMounted.current) return;
      setDicts(data);
      if (data.length > 0 && selectedDictId === null) {
        setSelectedDictId(data[0].id);
      }
    } catch {
      if (isMounted.current) showToast('Failed to load dictionaries.', 'error');
    } finally {
      if (isMounted.current) setLoadingDicts(false);
    }
  }, [projectId, selectedDictId, showToast]);

  useEffect(() => { loadDicts(); }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------------------
  // Load entries when selected dictionary changes
  // ---------------------------------------------------------------------------
  const loadEntries = useCallback(async (dictId: number) => {
    setLoadingEntries(true);
    setEntries([]);
    setPreviewResult(null);
    try {
      const data = await listEntries(projectId, dictId);
      if (!isMounted.current) return;
      setEntries(data);
    } catch {
      if (isMounted.current) showToast('Failed to load entries.', 'error');
    } finally {
      if (isMounted.current) setLoadingEntries(false);
    }
  }, [projectId, showToast]);

  useEffect(() => {
    if (selectedDictId !== null) loadEntries(selectedDictId);
  }, [selectedDictId, loadEntries]);

  // ---------------------------------------------------------------------------
  // Dictionary CRUD
  // ---------------------------------------------------------------------------
  const handleCreateDict = async () => {
    const name = newDictName.trim() || 'Dictionary';
    setCreatingDict(true);
    try {
      const dict = await createDictionary(projectId, name);
      if (!isMounted.current) return;
      setDicts(prev => [...prev, dict]);
      setSelectedDictId(dict.id);
      setShowNewDict(false);
      setNewDictName('');
    } catch {
      showToast('Failed to create dictionary.', 'error');
    } finally {
      if (isMounted.current) setCreatingDict(false);
    }
  };

  const handleRenameDict = async (dictId: number) => {
    const name = renameValue.trim();
    if (!name) return;
    setSavingRename(true);
    try {
      const updated = await updateDictionary(projectId, dictId, name);
      if (!isMounted.current) return;
      setDicts(prev => prev.map(d => d.id === dictId ? updated : d));
      setRenamingDictId(null);
    } catch {
      showToast('Failed to rename dictionary.', 'error');
    } finally {
      if (isMounted.current) setSavingRename(false);
    }
  };

  const handleDeleteDict = async (dictId: number) => {
    if (!confirm('Delete this dictionary and all its entries?')) return;
    try {
      await deleteDictionary(projectId, dictId);
      if (!isMounted.current) return;
      const next = dicts.filter(d => d.id !== dictId);
      setDicts(next);
      if (selectedDictId === dictId) {
        setSelectedDictId(next.length > 0 ? next[0].id : null);
        setEntries([]);
      }
    } catch {
      showToast('Failed to delete dictionary.', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Entry CRUD
  // ---------------------------------------------------------------------------
  const handleCreateEntry = async () => {
    if (!selectedDictId || !newRaw.trim()) return;
    setSavingEntry(true);
    try {
      const entry = await createEntry(projectId, selectedDictId, {
        raw_word: newRaw.trim(),
        replacement: newReplacement.trim(),
        is_regex: newIsRegex,
        enabled: true,
      });
      if (!isMounted.current) return;
      setEntries(prev => [...prev, entry]);
      setNewRaw('');
      setNewReplacement('');
      setNewIsRegex(false);
      setShowNewEntry(false);
      setPreviewResult(null);
    } catch {
      showToast('Failed to create entry.', 'error');
    } finally {
      if (isMounted.current) setSavingEntry(false);
    }
  };

  const handleToggleEnabled = async (entry: PronunciationEntry) => {
    if (!selectedDictId) return;
    try {
      const updated = await updateEntry(projectId, selectedDictId, entry.id, {
        ...entry,
        enabled: !entry.enabled,
      });
      if (!isMounted.current) return;
      setEntries(prev => prev.map(e => e.id === entry.id ? updated : e));
      setPreviewResult(null);
    } catch {
      showToast('Failed to update entry.', 'error');
    }
  };

  const handleSaveEditEntry = async () => {
    if (!selectedDictId || editingEntryId === null || !editRaw.trim()) return;
    const original = entries.find(e => e.id === editingEntryId);
    if (!original) return;
    setSavingEditEntry(true);
    try {
      const updated = await updateEntry(projectId, selectedDictId, editingEntryId, {
        ...original,
        raw_word: editRaw.trim(),
        replacement: editReplacement.trim(),
        is_regex: editIsRegex,
      });
      if (!isMounted.current) return;
      setEntries(prev => prev.map(e => e.id === editingEntryId ? updated : e));
      setEditingEntryId(null);
      setPreviewResult(null);
    } catch {
      showToast('Failed to save entry.', 'error');
    } finally {
      if (isMounted.current) setSavingEditEntry(false);
    }
  };

  const handleDeleteEntry = async (entryId: number) => {
    if (!selectedDictId) return;
    try {
      await deleteEntry(projectId, selectedDictId, entryId);
      if (!isMounted.current) return;
      setEntries(prev => prev.filter(e => e.id !== entryId));
      setPreviewResult(null);
    } catch {
      showToast('Failed to delete entry.', 'error');
    }
  };

  // ---------------------------------------------------------------------------
  // Preview
  // ---------------------------------------------------------------------------
  const handlePreview = async () => {
    if (!selectedDictId || !previewText.trim()) return;
    setPreviewing(true);
    try {
      const result = await previewDictionary(projectId, selectedDictId, previewText);
      if (!isMounted.current) return;
      setPreviewResult(result.result);
      setPreviewChanged(result.changed);
    } catch {
      showToast('Preview failed.', 'error');
    } finally {
      if (isMounted.current) setPreviewing(false);
    }
  };

  const selectedDict = dicts.find(d => d.id === selectedDictId) ?? null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-[var(--accent-500)] shrink-0" />
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">Pronunciation Dictionaries</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 inline-flex h-7 w-7 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100 transition-colors"
          aria-label="Close pronunciation editor"
        >
          <X size={14} />
        </button>
      </div>

      {loadingDicts ? (
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 py-4">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-4">
          {/* ---- Dictionary list ---- */}
          <div className="space-y-1">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-2">Dictionaries</p>
            {dicts.map(dict => (
              <div
                key={dict.id}
                className={`group flex items-center gap-1.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors ${
                  selectedDictId === dict.id
                    ? 'bg-[var(--accent-50)] dark:bg-zinc-800 text-[var(--accent-700)] dark:text-[var(--accent-100)]'
                    : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
                onClick={() => { setSelectedDictId(dict.id); setEditingEntryId(null); setShowNewEntry(false); setRenamingDictId(null); }}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedDictId(dict.id)}
              >
                {renamingDictId === dict.id ? (
                  <form
                    className="flex-1 flex items-center gap-1"
                    onSubmit={e => { e.preventDefault(); handleRenameDict(dict.id); }}
                    onClick={e => e.stopPropagation()}
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={e => setRenameValue(e.target.value)}
                      className="flex-1 min-w-0 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-900 dark:text-white focus:outline-none"
                    />
                    <button type="submit" disabled={savingRename} className="shrink-0 text-[var(--accent-600)] dark:text-[var(--accent-400)]">
                      {savingRename ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    </button>
                    <button type="button" onClick={() => setRenamingDictId(null)} className="shrink-0 text-zinc-400">
                      <X size={12} />
                    </button>
                  </form>
                ) : (
                  <>
                    <ChevronRight size={12} className={`shrink-0 transition-transform ${selectedDictId === dict.id ? 'rotate-90 text-[var(--accent-500)]' : 'text-zinc-300 dark:text-zinc-600'}`} />
                    <span className="flex-1 min-w-0 truncate text-xs font-medium">{dict.name}</span>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); setRenamingDictId(dict.id); setRenameValue(dict.name); }}
                      className="hidden group-hover:inline-flex shrink-0 h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100"
                      title="Rename"
                    >
                      <Pencil size={10} />
                    </button>
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); handleDeleteDict(dict.id); }}
                      className="hidden group-hover:inline-flex shrink-0 h-5 w-5 items-center justify-center rounded text-zinc-400 hover:text-red-500"
                      title="Delete dictionary"
                    >
                      <Trash2 size={10} />
                    </button>
                  </>
                )}
              </div>
            ))}

            {/* New dictionary */}
            {showNewDict ? (
              <form
                className="flex items-center gap-1 px-2 py-1"
                onSubmit={e => { e.preventDefault(); handleCreateDict(); }}
              >
                <input
                  autoFocus
                  value={newDictName}
                  onChange={e => setNewDictName(e.target.value)}
                  placeholder="Dictionary name"
                  className="flex-1 min-w-0 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-950 px-1.5 py-0.5 text-xs text-zinc-900 dark:text-white focus:outline-none"
                />
                <button type="submit" disabled={creatingDict} className="shrink-0 text-[var(--accent-600)]">
                  {creatingDict ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                </button>
                <button type="button" onClick={() => setShowNewDict(false)} className="shrink-0 text-zinc-400"><X size={12} /></button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setShowNewDict(true)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                <Plus size={12} /> New dictionary
              </button>
            )}
          </div>

          {/* ---- Entry list ---- */}
          <div className="min-w-0 space-y-3">
            {selectedDict === null ? (
              <p className="text-sm text-zinc-400 dark:text-zinc-500 py-4">Select a dictionary to manage its entries.</p>
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                  Rules in &ldquo;{selectedDict.name}&rdquo;
                </p>

                {loadingEntries ? (
                  <div className="flex items-center gap-2 text-sm text-zinc-500 py-2">
                    <Loader2 size={13} className="animate-spin" /> Loading entries…
                  </div>
                ) : (
                  <>
                    {entries.length === 0 && !showNewEntry && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">No entries yet. Add one below.</p>
                    )}

                    {/* Entry rows */}
                    <div className="space-y-1">
                      {entries.map(entry => (
                        <div key={entry.id} className="group flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2">
                          {editingEntryId === entry.id ? (
                            <div className="flex-1 flex flex-wrap items-center gap-2">
                              <input
                                autoFocus
                                value={editRaw}
                                onChange={e => setEditRaw(e.target.value)}
                                placeholder="Word / pattern"
                                className="w-32 min-w-0 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-white focus:outline-none"
                              />
                              <span className="text-zinc-400">→</span>
                              <input
                                value={editReplacement}
                                onChange={e => setEditReplacement(e.target.value)}
                                placeholder="Replacement"
                                className="w-32 min-w-0 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-white focus:outline-none"
                              />
                              <label className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
                                <input type="checkbox" checked={editIsRegex} onChange={e => setEditIsRegex(e.target.checked)} className="h-3 w-3 accent-[var(--accent-500)]" />
                                Regex
                              </label>
                              <button
                                type="button"
                                disabled={savingEditEntry}
                                onClick={handleSaveEditEntry}
                                className="inline-flex items-center gap-1 rounded-md bg-zinc-900 dark:bg-[var(--accent-600)] px-2 py-1 text-[10px] font-semibold text-white disabled:opacity-50"
                              >
                                {savingEditEntry ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Save
                              </button>
                              <button type="button" onClick={() => setEditingEntryId(null)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                title={entry.enabled ? 'Disable entry' : 'Enable entry'}
                                onClick={() => handleToggleEnabled(entry)}
                                className="shrink-0 text-zinc-300 dark:text-zinc-600 hover:text-[var(--accent-500)] transition-colors"
                              >
                                {entry.enabled
                                  ? <ToggleRight size={16} className="text-[var(--accent-500)]" />
                                  : <ToggleLeft size={16} />}
                              </button>
                              <code className={`flex-1 min-w-0 truncate text-xs font-mono ${entry.enabled ? 'text-zinc-800 dark:text-zinc-100' : 'text-zinc-400 line-through'}`}>
                                {entry.raw_word}
                              </code>
                              <span className="shrink-0 text-zinc-400 text-xs">→</span>
                              <code className={`w-28 min-w-0 truncate text-xs font-mono ${entry.enabled ? 'text-zinc-700 dark:text-zinc-200' : 'text-zinc-400 line-through'}`}>
                                {entry.replacement}
                              </code>
                              {entry.is_regex && (
                                <span className="shrink-0 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[9px] font-semibold text-zinc-500 dark:text-zinc-400">
                                  regex
                                </span>
                              )}
                              <button
                                type="button"
                                title="Edit"
                                onClick={() => {
                                  setEditingEntryId(entry.id);
                                  setEditRaw(entry.raw_word);
                                  setEditReplacement(entry.replacement);
                                  setEditIsRegex(entry.is_regex);
                                }}
                                className="hidden group-hover:inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-100"
                              >
                                <Pencil size={11} />
                              </button>
                              <button
                                type="button"
                                title="Delete"
                                onClick={() => handleDeleteEntry(entry.id)}
                                className="hidden group-hover:inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-zinc-400 hover:text-red-500"
                              >
                                <Trash2 size={11} />
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* New entry form */}
                    {showNewEntry ? (
                      <div className="rounded-lg border border-[var(--accent-100)] dark:border-zinc-700 bg-white dark:bg-zinc-950 px-3 py-3 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">New rule</p>
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            autoFocus
                            value={newRaw}
                            onChange={e => setNewRaw(e.target.value)}
                            placeholder="Word / pattern"
                            className="w-32 min-w-0 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-white focus:outline-none"
                          />
                          <span className="text-zinc-400">→</span>
                          <input
                            value={newReplacement}
                            onChange={e => setNewReplacement(e.target.value)}
                            placeholder="Replacement"
                            className="w-32 min-w-0 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-2 py-1 text-xs text-zinc-900 dark:text-white focus:outline-none"
                          />
                          <label className="flex items-center gap-1 text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 cursor-pointer select-none">
                            <input type="checkbox" checked={newIsRegex} onChange={e => setNewIsRegex(e.target.checked)} className="h-3 w-3 accent-[var(--accent-500)]" />
                            Regex
                          </label>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button
                            type="button"
                            onClick={() => { setShowNewEntry(false); setNewRaw(''); setNewReplacement(''); setNewIsRegex(false); }}
                            className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 px-2.5 text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            disabled={savingEntry || !newRaw.trim()}
                            onClick={handleCreateEntry}
                            className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-[var(--accent-600)] px-3 text-[11px] font-semibold text-white hover:bg-zinc-700 dark:hover:bg-[var(--accent-500)] transition-colors disabled:opacity-50"
                          >
                            {savingEntry ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Add rule
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setShowNewEntry(true)}
                        className="flex items-center gap-1.5 rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors w-full justify-center"
                      >
                        <Plus size={13} /> Add rule
                      </button>
                    )}

                    {/* Preview */}
                    {entries.some(e => e.enabled) && (
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Preview</p>
                        <div className="flex gap-2">
                          <input
                            value={previewText}
                            onChange={e => { setPreviewText(e.target.value); setPreviewResult(null); }}
                            onKeyDown={e => e.key === 'Enter' && handlePreview()}
                            placeholder="Type sample text…"
                            className="flex-1 min-w-0 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-1.5 text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[var(--accent-100)]"
                          />
                          <button
                            type="button"
                            disabled={previewing || !previewText.trim()}
                            onClick={handlePreview}
                            className="shrink-0 inline-flex h-8 items-center gap-1.5 rounded-lg bg-zinc-900 dark:bg-zinc-800 px-3 text-[11px] font-semibold text-white hover:bg-zinc-700 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
                          >
                            {previewing ? <Loader2 size={11} className="animate-spin" /> : null}
                            Preview
                          </button>
                        </div>
                        {previewResult !== null && (
                          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs space-y-1">
                            <p className="text-zinc-500 dark:text-zinc-400">
                              <span className="font-semibold">{previewChanged}</span> rule{previewChanged !== 1 ? 's' : ''} applied
                            </p>
                            <p className="font-mono text-zinc-700 dark:text-zinc-200 break-words">{previewResult}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PronunciationEditor;
