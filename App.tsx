/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * App.tsx — Root Application Component
 *
 * Owns all top-level state: active voice, AI results, filter criteria, view mode,
 * theme (dark/light), carousel index, and modal visibility flags. Delegates
 * rendering to Carousel3D or GridView based on viewMode, and conditionally
 * renders modals (VoiceFinder, ScriptReader, Settings, History, AiResultCard).
 *
 * Theme preference is persisted to the Go backend via /api/config so it survives
 * across sessions. Filtering logic is memoized with useMemo; when an AI result
 * is active, the voice list is narrowed to only recommended voices.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { VOICE_DATA } from './constants';
import Carousel3D from './components/Carousel3D';
import GridView from './components/GridView';
import PresetCarousel3D from './components/PresetCarousel3D';
import PresetGrid from './components/PresetGrid';
import PresetEditModal from './components/PresetEditModal';
import FilterBar from './components/FilterBar';
import VoiceFinder from './components/VoiceFinder';
import AiResultCard from './components/AiResultCard';
import ScriptReaderModal from './components/ScriptReaderModal';
import SettingsModal from './components/SettingsModal';
import HistoryPanel from './components/HistoryPanel';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import { FilterState, AiRecommendation, CustomPreset } from './types';
import { Info, Sparkles, X } from 'lucide-react';
import { getConfig, updateConfig, listPresets, deletePreset as apiDeletePreset, createPreset as apiCreatePreset, updatePreset as apiUpdatePreset, listFavorites, toggleFavorite as apiToggleFavorite, exportPresets as apiExportPresets, importPresets as apiImportPresets, reorderPresets as apiReorderPresets } from './api';
import { useToast } from './components/ToastProvider';

const App: React.FC = () => {
  const { showToast } = useToast();

  // --- Core playback and AI state ---
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiRecommendation | null>(null);
  const [isAiCardVisible, setIsAiCardVisible] = useState(false);

  // --- Modal visibility flags ---
  const [showVoiceFinder, setShowVoiceFinder] = useState(false);
  const [showScriptReader, setShowScriptReader] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // --- View and theme state ---
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>('carousel');
  const [isDarkMode, setIsDarkMode] = useState(false);
  
  // Carousel state
  const [activeIndex, setActiveIndex] = useState(0);

  // Voice tab and custom presets state
  const [voiceTab, setVoiceTab] = useState<'stock' | 'custom'>('stock');
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
  const [playingPresetId, setPlayingPresetId] = useState<number | null>(null);
  const [editingPreset, setEditingPreset] = useState<CustomPreset | null>(null);
  const [activePresetIndex, setActivePresetIndex] = useState(0);
  const [favoriteVoices, setFavoriteVoices] = useState<Set<string>>(new Set());
  const [similarTo, setSimilarTo] = useState<string | null>(null);
  const [presetTagFilter, setPresetTagFilter] = useState<string | null>(null);

  const [filters, setFilters] = useState<FilterState>({
    gender: 'All',
    pitch: 'All',
    search: '',
  });

  // Load saved theme preference from backend config on first mount
  useEffect(() => {
    getConfig().then(cfg => {
      if (cfg.theme === 'dark') setIsDarkMode(true);
    }).catch(() => {}); // ignore if backend not available
  }, []);

  // Apply dark mode class to document root whenever isDarkMode changes
  useEffect(() => {
    if (isDarkMode) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  /** Fetch custom presets from the backend. */
  const refreshPresets = useCallback(() => {
    listPresets().then(setCustomPresets).catch(() => {});
  }, []);

  // Load custom presets on mount
  useEffect(() => {
    refreshPresets();
  }, [refreshPresets]);

  // Load favorites on mount
  useEffect(() => {
    listFavorites().then(names => setFavoriteVoices(new Set(names))).catch(() => {});
  }, []);

  /** Toggle dark/light theme and persist the preference to the backend. */
  const toggleTheme = useCallback(() => {
    setIsDarkMode(prev => {
      const next = !prev;
      updateConfig({ theme: next ? 'dark' : 'light' }).catch(() => {});
      return next;
    });
  }, []);

  // Extract unique gender and pitch values for the filter dropdowns
  const uniqueGenders = useMemo(() => Array.from(new Set(VOICE_DATA.map(v => v.analysis.gender))).sort(), []);
  const uniquePitches = useMemo(() => Array.from(new Set(VOICE_DATA.map(v => v.analysis.pitch))).sort(), []);

  // Global keyboard shortcut: "?" to toggle shortcuts overlay
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === '?') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  /**
   * Compute the filtered voice list. When an AI result is active, show only
   * the recommended voices. Otherwise apply gender/pitch/search filters.
   */
  const filteredVoices = useMemo(() => {
    let baseData = VOICE_DATA;
    if (aiResult) {
       const recommended = aiResult.voiceNames
          .map(name => VOICE_DATA.find(v => v.name === name))
          .filter((v): v is typeof VOICE_DATA[0] => !!v);
       return recommended.length > 0 ? recommended : baseData;
    }

    if (similarTo) {
      const source = VOICE_DATA.find(v => v.name === similarTo);
      if (source) {
        const srcChars = new Set(source.analysis.characteristics.map(c => c.toLowerCase()));
        const scored = VOICE_DATA
          .filter(v => v.name !== similarTo)
          .map(v => {
            const tgtChars = new Set(v.analysis.characteristics.map(c => c.toLowerCase()));
            const intersection = [...srcChars].filter(c => tgtChars.has(c)).length;
            const union = new Set([...srcChars, ...tgtChars]).size;
            let score = union > 0 ? intersection / union : 0;
            if (v.analysis.gender === source.analysis.gender) score += 0.15;
            if (v.analysis.pitch === source.analysis.pitch) score += 0.1;
            return { voice: v, score };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, 8);
        return [source, ...scored.map(s => s.voice)];
      }
    }

    return baseData.filter(voice => {
      const matchGender = filters.gender === 'All' || voice.analysis.gender === filters.gender;
      const matchPitch = filters.pitch === 'All' || voice.analysis.pitch === filters.pitch;
      
      const searchLower = filters.search.toLowerCase();
      const matchSearch = filters.search === '' || 
        voice.name.toLowerCase().includes(searchLower) || 
        voice.characteristics.some(c => c.toLowerCase().includes(searchLower)) ||
        voice.analysis.characteristics.some(c => c.toLowerCase().includes(searchLower)) ||
        voice.analysis.gender.toLowerCase().startsWith(searchLower) ||
        voice.pitch.toLowerCase().includes(searchLower) ||
        voice.analysis.pitch.toLowerCase().includes(searchLower);

      return matchGender && matchPitch && matchSearch;
    });
  }, [filters, aiResult, similarTo]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredVoices.length]);

  const filteredPresets = useMemo(() => {
    if (!presetTagFilter) return customPresets;
    return customPresets.filter(p => p.tags?.some(t => t.tag === presetTagFilter));
  }, [customPresets, presetTagFilter]);

  const allPresetTags = useMemo(() => {
    const tagMap = new Map<string, string>();
    for (const p of customPresets) {
      for (const t of (p.tags || [])) {
        if (!tagMap.has(t.tag)) tagMap.set(t.tag, t.color);
      }
    }
    return Array.from(tagMap.entries()).map(([tag, color]) => ({ tag, color }));
  }, [customPresets]);

  // Reset preset carousel index when presets list changes
  useEffect(() => {
    setActivePresetIndex(0);
  }, [customPresets.length]);

  /** Toggle playback of a voice sample; stops current if same voice clicked again. */
  const handlePlayToggle = (voiceName: string) => {
    setPlayingVoice(current => current === voiceName ? null : voiceName);
  };

  /** Toggle a voice's favorite status. */
  const handleFavoriteToggle = useCallback(async (voiceName: string) => {
    const isFav = favoriteVoices.has(voiceName);
    // Optimistic update
    setFavoriteVoices(prev => {
      const next = new Set(prev);
      if (isFav) next.delete(voiceName); else next.add(voiceName);
      return next;
    });
    try {
      await apiToggleFavorite(voiceName, !isFav);
      showToast(isFav ? `Removed ${voiceName} from favorites` : `Added ${voiceName} to favorites`, 'success');
    } catch {
      // Revert on error
      setFavoriteVoices(prev => {
        const next = new Set(prev);
        if (isFav) next.add(voiceName); else next.delete(voiceName);
        return next;
      });
      showToast('Failed to update favorite', 'error');
    }
  }, [favoriteVoices, showToast]);

  const handleFindSimilar = useCallback((voiceName: string) => {
    setSimilarTo(prev => prev === voiceName ? null : voiceName);
    setActiveIndex(0);
  }, []);

  /** Dismiss the AI result card and reset filters. */
  const clearAiResult = () => {
    setAiResult(null);
    setIsAiCardVisible(false);
    setFilters({ ...filters, search: '' });
  };

  /** Toggle preset audio playback. */
  const handlePresetPlayToggle = (presetId: number) => {
    setPlayingPresetId(current => current === presetId ? null : presetId);
  };

  /** Handle preset deletion with confirmation. */
  const handlePresetDelete = async (preset: CustomPreset) => {
    if (!confirm(`Delete preset "${preset.name}"?`)) return;
    try {
      await apiDeletePreset(preset.id);
      refreshPresets();
      showToast(`Preset "${preset.name}" deleted`, 'success');
    } catch (err) {
      console.error('Failed to delete preset:', err);
      showToast('Failed to delete preset', 'error');
    }
  };

  /** Open the edit modal for a preset. */
  const handlePresetEdit = (preset: CustomPreset) => {
    setEditingPreset(preset);
  };

  /** Duplicate an existing preset. */
  const handlePresetDuplicate = async (preset: CustomPreset) => {
    try {
      await apiCreatePreset({
        name: `${preset.name} (Copy)`,
        voice_name: preset.voice_name,
        system_instruction: preset.system_instruction ?? undefined,
        sample_text: preset.sample_text ?? undefined,
        source_query: preset.source_query ?? undefined,
      });
      refreshPresets();
      showToast(`Duplicated "${preset.name}"`, 'success');
    } catch (err) {
      console.error('Failed to duplicate preset:', err);
      showToast('Failed to duplicate preset', 'error');
    }
  };

  /** Save edited preset to the backend. */
  const handlePresetEditSave = async (id: number, data: { name?: string; system_instruction?: string; color?: string }) => {
    await apiUpdatePreset(id, data);
    refreshPresets();
    showToast('Preset updated', 'success');
  };

  const handlePresetInlineEdit = async (id: number, data: { name?: string; system_instruction?: string }) => {
    await apiUpdatePreset(id, data);
    refreshPresets();
    showToast('Preset updated', 'success');
  };

  /** Save a new custom voice preset from the AI result TTS preview. */
  const handleSavePreset = async (data: { voiceName: string; text: string; systemInstruction: string; audioBase64: string | null; sourceQuery: string }) => {
    const name = prompt(`Name this voice preset (e.g., "Friendly Narrator"):`)?.trim();
    if (!name) return;
    try {
      await apiCreatePreset({
        name,
        voice_name: data.voiceName,
        system_instruction: data.systemInstruction,
        sample_text: data.text,
        audio_base64: data.audioBase64 || undefined,
        source_query: data.sourceQuery,
      });
      refreshPresets();
      setVoiceTab('custom');
      showToast(`Preset "${name}" saved`, 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to save preset.';
      if (msg.includes('UNIQUE')) {
        showToast(`A preset named "${name}" already exists`, 'warning');
      } else {
        showToast(msg, 'error');
      }
    }
  };

  const handleExportPresets = async () => {
    try {
      await apiExportPresets();
      showToast('Presets exported', 'success');
    } catch {
      showToast('Failed to export presets', 'error');
    }
  };

  const handleImportPresets = async (file: File) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data)) throw new Error('Invalid file format');
      const result = await apiImportPresets(data);
      refreshPresets();
      showToast(`Imported ${result.imported} preset(s)${result.skipped ? `, ${result.skipped} skipped` : ''}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to import presets', 'error');
    }
  };

  const handleReorderPresets = async (orderedIds: number[]) => {
    // Optimistic update: reorder local state immediately
    const reordered = orderedIds.map(id => customPresets.find(p => p.id === id)).filter(Boolean) as CustomPreset[];
    setCustomPresets(reordered);
    try {
      await apiReorderPresets(orderedIds);
    } catch (err: any) {
      // Revert on failure
      refreshPresets();
      showToast('Failed to reorder presets', 'error');
    }
  };

  const isModalOpen = showVoiceFinder || showScriptReader || showSettings || showHistory || showShortcuts || (aiResult && isAiCardVisible) || !!editingPreset;

  return (
    <div className="h-screen w-screen bg-[#FDFDFD] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden flex flex-col relative transition-colors duration-300">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-50 dark:bg-blue-900/20 blur-3xl opacity-60"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-50 dark:bg-purple-900/20 blur-3xl opacity-50"></div>
      </div>

      {/* Main App Content - aria-hidden and inert when modal is open */}
      <div 
        className="flex flex-col flex-1 overflow-hidden" 
        aria-hidden={isModalOpen}
        // @ts-ignore - 'inert' is a standard attribute but might not be in all TS types yet
        inert={isModalOpen ? '' : undefined}
        style={isModalOpen ? { pointerEvents: 'none' } : {}}
      >
        <FilterBar 
          filters={filters}
          onFilterChange={setFilters}
          uniqueGenders={uniqueGenders}
          uniquePitches={uniquePitches}
          onOpenAiCasting={() => setShowVoiceFinder(true)}
          onOpenScriptReader={() => setShowScriptReader(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHistory={() => setShowHistory(true)}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isDarkMode={isDarkMode}
          toggleTheme={toggleTheme}
          voiceTab={voiceTab}
          onVoiceTabChange={setVoiceTab}
          customPresetCount={customPresets.length}
        />

        <main className="flex-1 relative flex flex-col overflow-hidden">
              {voiceTab === 'custom' ? (
                customPresets.length > 0 ? (
                  viewMode === 'carousel' ? (
                    <div className="w-full flex-1 flex items-center justify-center pb-8 min-h-0">
                      <PresetCarousel3D
                        presets={filteredPresets}
                        activeIndex={activePresetIndex}
                        onChange={setActivePresetIndex}
                        playingPresetId={playingPresetId}
                        onPlayToggle={handlePresetPlayToggle}
                        onEdit={handlePresetEdit}
                        onDelete={handlePresetDelete}
                        onDuplicate={handlePresetDuplicate}
                        disabled={isModalOpen}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      {/* Tag filter bar */}
                      {allPresetTags.length > 0 && (
                        <div className="sticky top-0 z-10 flex items-center gap-2 py-2 px-4 sm:px-6 lg:px-8 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm border-b border-zinc-100 dark:border-zinc-800">
                          <span className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider shrink-0">Tags</span>
                          <div className="flex flex-wrap gap-1.5">
                            {allPresetTags.map(t => (
                              <button
                                key={t.tag}
                                onClick={() => setPresetTagFilter(presetTagFilter === t.tag ? null : t.tag)}
                                className={`inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full transition-all ${presetTagFilter === t.tag ? 'text-white ring-2 ring-offset-1 ring-zinc-400 dark:ring-zinc-500' : 'text-white opacity-60 hover:opacity-100'}`}
                                style={{ backgroundColor: t.color }}
                              >
                                {t.tag}
                              </button>
                            ))}
                            {presetTagFilter && (
                              <button
                                onClick={() => setPresetTagFilter(null)}
                                className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
                              >
                                Clear
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      <PresetGrid
                        presets={filteredPresets}
                        playingPresetId={playingPresetId}
                        onPlayToggle={handlePresetPlayToggle}
                        onEdit={handlePresetEdit}
                        onDelete={handlePresetDelete}
                        onDuplicate={handlePresetDuplicate}
                        onOpenAiCasting={() => setShowVoiceFinder(true)}
                        onExport={handleExportPresets}
                        onImport={handleImportPresets}
                        onInlineEdit={handlePresetInlineEdit}
                        onReorder={handleReorderPresets}
                      />
                    </div>
                  )
                ) : (
                  <div className="flex-1 overflow-y-auto">
                    <PresetGrid
                      presets={customPresets}
                      playingPresetId={playingPresetId}
                      onPlayToggle={handlePresetPlayToggle}
                      onEdit={handlePresetEdit}
                      onDelete={handlePresetDelete}
                      onDuplicate={handlePresetDuplicate}
                      onOpenAiCasting={() => setShowVoiceFinder(true)}
                      onExport={handleExportPresets}
                      onImport={handleImportPresets}
                      onInlineEdit={handlePresetInlineEdit}
                      onReorder={handleReorderPresets}
                    />
                  </div>
                )
              ) : filteredVoices.length > 0 ? (
                  viewMode === 'carousel' ? (
                    <div className="w-full flex-1 flex items-center justify-center pb-8 min-h-0">
                         <Carousel3D 
                            voices={filteredVoices}
                            activeIndex={activeIndex}
                            onChange={setActiveIndex}
                            playingVoice={playingVoice}
                            onPlayToggle={handlePlayToggle}
                            disabled={isModalOpen}
                         />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      {similarTo && (
                        <div className="sticky top-0 z-10 flex items-center justify-center gap-2 py-2 px-4 bg-indigo-50/80 dark:bg-indigo-950/50 backdrop-blur-sm border-b border-indigo-100 dark:border-indigo-900/50">
                          <Sparkles size={14} className="text-indigo-500" />
                          <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
                            Showing voices similar to <span className="font-semibold">{similarTo}</span>
                          </span>
                          <button
                            onClick={() => setSimilarTo(null)}
                            className="ml-2 p-0.5 rounded-full hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors"
                            aria-label="Clear similar voices filter"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      )}
                      <GridView 
                          voices={filteredVoices}
                          playingVoice={playingVoice}
                          onPlayToggle={handlePlayToggle}
                          favoriteVoices={favoriteVoices}
                          onFavoriteToggle={handleFavoriteToggle}
                          onFindSimilar={handleFindSimilar}
                      />
                    </div>
                  )
              ) : (
                  <div className="w-full h-full flex items-center justify-center pb-24">
                      <div className="text-center animate-fade-in">
                          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mb-6 shadow-sm">
                              <Info size={32} className="text-zinc-300 dark:text-zinc-500" />
                          </div>
                          <h3 className="text-xl font-serif text-zinc-900 dark:text-white mb-2">No voices found</h3>
                          <p className="text-zinc-500 dark:text-zinc-400 mb-6">Try adjusting your filters or use AI Match.</p>
                          <button 
                              onClick={() => setShowVoiceFinder(true)}
                              className="px-4 py-2 bg-zinc-900 dark:bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors"
                          >
                              Open AI Casting
                          </button>
                      </div>
                  </div>
              )}
              
              {voiceTab === 'stock' && !aiResult && filteredVoices.length > 0 && viewMode === 'carousel' && (
                  <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium tracking-widest uppercase bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm inline-block px-3 py-1 rounded-full border border-white/50 dark:border-zinc-800">
                          {activeIndex + 1} / {filteredVoices.length}
                      </p>
                  </div>
              )}

              {voiceTab === 'custom' && customPresets.length > 0 && viewMode === 'carousel' && (
                  <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
                      <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium tracking-widest uppercase bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm inline-block px-3 py-1 rounded-full border border-white/50 dark:border-zinc-800">
                          {activePresetIndex + 1} / {customPresets.length}
                      </p>
                  </div>
              )}
        </main>
      </div>

      {/* Modals are rendered outside the aria-hidden container */}
      {showVoiceFinder && (
        <VoiceFinder 
            voices={VOICE_DATA}
            onRecommendation={(rec) => {
                if (rec) {
                    setAiResult(rec);
                    setIsAiCardVisible(true);
                    setSimilarTo(null);
                    setFilters(prev => ({ ...prev, search: '' })); 
                }
                setShowVoiceFinder(false);
            }}
            onClose={() => setShowVoiceFinder(false)}
        />
      )}

      {showScriptReader && (
        <ScriptReaderModal
            voices={VOICE_DATA}
            customPresets={customPresets}
            initialVoiceName={playingVoice || filteredVoices[activeIndex]?.name}
            onClose={() => setShowScriptReader(false)}
        />
      )}

      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}

      {showHistory && (
        <HistoryPanel onClose={() => setShowHistory(false)} />
      )}

      {aiResult && isAiCardVisible && (
          <div 
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ai-result-title"
          >
             <div className="absolute inset-0" onClick={clearAiResult}></div>
             <div className="relative w-full max-w-5xl animate-slide-up max-h-[90vh] overflow-hidden rounded-2xl">
                 <AiResultCard 
                    result={aiResult} 
                    voices={filteredVoices} 
                    onClose={clearAiResult}
                    onSavePreset={handleSavePreset}
                 />
             </div>
          </div>
      )}

      {editingPreset && (
        <PresetEditModal
          preset={editingPreset}
          onSave={handlePresetEditSave}
          onClose={() => setEditingPreset(null)}
        />
      )}

      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

    </div>
  );
};

export default App;