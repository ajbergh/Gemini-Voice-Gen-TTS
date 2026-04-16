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
import { FilterState, AiRecommendation, CustomPreset } from './types';
import { Info } from 'lucide-react';
import { getConfig, updateConfig, listPresets, deletePreset as apiDeletePreset, createPreset as apiCreatePreset, updatePreset as apiUpdatePreset } from './api';

const App: React.FC = () => {
  // --- Core playback and AI state ---
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AiRecommendation | null>(null);
  const [isAiCardVisible, setIsAiCardVisible] = useState(false);

  // --- Modal visibility flags ---
  const [showVoiceFinder, setShowVoiceFinder] = useState(false);
  const [showScriptReader, setShowScriptReader] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

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
  }, [filters, aiResult]);

  useEffect(() => {
    setActiveIndex(0);
  }, [filteredVoices.length]);

  // Reset preset carousel index when presets list changes
  useEffect(() => {
    setActivePresetIndex(0);
  }, [customPresets.length]);

  /** Toggle playback of a voice sample; stops current if same voice clicked again. */
  const handlePlayToggle = (voiceName: string) => {
    setPlayingVoice(current => current === voiceName ? null : voiceName);
  };

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
    } catch (err) {
      console.error('Failed to delete preset:', err);
    }
  };

  /** Open the edit modal for a preset. */
  const handlePresetEdit = (preset: CustomPreset) => {
    setEditingPreset(preset);
  };

  /** Save edited preset to the backend. */
  const handlePresetEditSave = async (id: number, data: { name?: string; system_instruction?: string }) => {
    await apiUpdatePreset(id, data);
    refreshPresets();
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
    } catch (err: any) {
      const msg = err?.message || 'Failed to save preset.';
      alert(msg.includes('UNIQUE') ? `A preset named "${name}" already exists. Please choose a different name.` : msg);
    }
  };

  const isModalOpen = showVoiceFinder || showScriptReader || showSettings || showHistory || (aiResult && isAiCardVisible) || !!editingPreset;

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
                        presets={customPresets}
                        activeIndex={activePresetIndex}
                        onChange={setActivePresetIndex}
                        playingPresetId={playingPresetId}
                        onPlayToggle={handlePresetPlayToggle}
                        onEdit={handlePresetEdit}
                        onDelete={handlePresetDelete}
                        disabled={isModalOpen}
                      />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-y-auto">
                      <PresetGrid
                        presets={customPresets}
                        playingPresetId={playingPresetId}
                        onPlayToggle={handlePresetPlayToggle}
                        onEdit={handlePresetEdit}
                        onDelete={handlePresetDelete}
                        onOpenAiCasting={() => setShowVoiceFinder(true)}
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
                      onOpenAiCasting={() => setShowVoiceFinder(true)}
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
                      <GridView 
                          voices={filteredVoices}
                          playingVoice={playingVoice}
                          onPlayToggle={handlePlayToggle}
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

    </div>
  );
};

export default App;