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
 * renders modals (VoiceFinder, ScriptReader, Settings, History, AiResultCard,
 * preset edit, and the custom preset save dialog).
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
import SavePresetDialog from './components/SavePresetDialog';
import FilterBar from './components/FilterBar';
import NavigationSidebar, { AppSection } from './components/NavigationSidebar';
import VoiceFinder from './components/VoiceFinder';
import AiResultCard from './components/AiResultCard';
import ProjectWorkspace from './components/ProjectWorkspace';
import ScriptReaderModal from './components/ScriptReaderModal';
import SettingsModal from './components/SettingsModal';
import HistoryPanel from './components/HistoryPanel';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal';
import MiniPlayer from './components/MiniPlayer';
import CommandPalette from './components/CommandPalette';
import OnboardingTour from './components/OnboardingTour';
import JobCenter, { useJobBadge } from './components/JobCenter';
import { FilterState, AiRecommendation, CustomPreset } from './types';
import { Info, Sparkles, X } from 'lucide-react';
import { getConfig, updateConfig, listPresets, deletePreset as apiDeletePreset, createPreset as apiCreatePreset, updatePreset as apiUpdatePreset, listFavorites, toggleFavorite as apiToggleFavorite, exportPresets as apiExportPresets, importPresets as apiImportPresets, reorderPresets as apiReorderPresets, regeneratePresetImage as apiRegeneratePresetImage } from './api';
import { useToast } from './components/ToastProvider';

interface PendingPresetSave {
  voiceName: string;
  text: string;
  systemInstruction: string;
  audioBase64: string | null;
  sourceQuery: string;
  personDescription?: string;
}

const PRESET_NAME_STOPWORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with',
  'voice', 'voices', 'sound', 'sounding', 'style', 'persona', 'persona', 'person', 'character',
  'male', 'female', 'man', 'woman', 'guy', 'girl', 'someone', 'someone', 'that', 'this', 'who',
  'warm', 'cool', 'very', 'really', 'need', 'want', 'looking', 'like'
]);

const PRESET_NAME_ROLE_WORDS = new Set([
  'narrator', 'host', 'guide', 'announcer', 'presenter', 'speaker', 'coach', 'assistant', 'mentor',
  'commentator', 'storyteller', 'companion', 'caster', 'director', 'reader', 'performer'
]);

/** Convert a token to title case for generated preset names. */
function toTitleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

/** Build a short, human-readable preset name from casting context. */
function buildSuggestedPresetName(data: PendingPresetSave): string {
  const tokenSource = `${data.sourceQuery || ''} ${data.personDescription || ''}`.toLowerCase();
  const tokens: string[] = tokenSource.match(/[a-z0-9]+/g) ?? [];
  const meaningful = tokens.filter(token => token.length > 2 && !PRESET_NAME_STOPWORDS.has(token));
  const role = meaningful.find(token => PRESET_NAME_ROLE_WORDS.has(token));
  const descriptors = meaningful
    .filter(token => token !== role)
    .slice(0, role ? 2 : 3)
    .map(toTitleCase);

  const parts = role ? [...descriptors, toTitleCase(role)] : descriptors;
  if (parts.length > 0) return parts.join(' ');

  return `${data.voiceName} Signature`;
}

/** Render the root application shell, global state, navigation, and modal stack. */
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
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showJobCenter, setShowJobCenter] = useState(false);

  // Job badge data for sidebar
  const { badgeCount: jobBadgeCount, hasActive: hasActiveJob, latestPercent: activeJobPercent } = useJobBadge();

  // --- View and theme state ---
  const [viewMode, setViewMode] = useState<'carousel' | 'grid'>('carousel');
  const [gridDensity, setGridDensity] = useState<import('./types').GridDensity>('comfortable');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [accentColor, setAccentColor] = useState<string>(() => localStorage.getItem('gemini-accent') || 'indigo');
  const [highContrast, setHighContrast] = useState<boolean>(() => localStorage.getItem('gemini-high-contrast') === 'true');
  const [activeSection, setActiveSection] = useState<AppSection>('voices');
  
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
  const [scriptVoiceName, setScriptVoiceName] = useState<string>(VOICE_DATA[0]?.name ?? '');
  const [pendingPresetSave, setPendingPresetSave] = useState<PendingPresetSave | null>(null);
  const [pendingPresetName, setPendingPresetName] = useState('');
  const [pendingPresetError, setPendingPresetError] = useState<string | null>(null);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [savePresetProgress, setSavePresetProgress] = useState(0);
  const [savePresetProgressLabel, setSavePresetProgressLabel] = useState('Ready to save preset');

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

  // Apply accent color to document root
  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accentColor);
    localStorage.setItem('gemini-accent', accentColor);
  }, [accentColor]);

  // Apply high-contrast mode
  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', highContrast);
    localStorage.setItem('gemini-high-contrast', String(highContrast));
  }, [highContrast]);

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

  // Global keyboard shortcuts: "?" for help, Ctrl+K for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K — command palette (works even in inputs)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(prev => !prev);
        return;
      }
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

  const POPULAR_VOICES = useMemo(() => new Set(['Kore', 'Puck', 'Charon', 'Aoede', 'Fenrir', 'Leda']), []);
  const voiceBadges = useMemo(() => {
    const map = new Map<string, string[]>();
    const aiNames = aiResult ? new Set(aiResult.voiceNames) : null;
    for (const v of VOICE_DATA) {
      const badges: string[] = [];
      if (aiNames?.has(v.name)) badges.push('AI Pick');
      if (POPULAR_VOICES.has(v.name)) badges.push('Popular');
      if (badges.length > 0) map.set(v.name, badges);
    }
    return map;
  }, [aiResult, POPULAR_VOICES]);

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

  /** Dismiss the AI result card and return the voice search state to neutral. */
  const clearAiResult = () => {
    setAiResult(null);
    setIsAiCardVisible(false);
    setFilters({ ...filters, search: '' });
  };

  useEffect(() => {
    if (!isSavingPreset) {
      setSavePresetProgress(0);
      setSavePresetProgressLabel('Ready to save preset');
      return;
    }

    setSavePresetProgress(12);
    setSavePresetProgressLabel('Saving your custom voice preset...');

    const intervalId = window.setInterval(() => {
      setSavePresetProgress(current => {
        if (current >= 90) return current;
        if (current < 42) return current + 10;
        if (current < 72) return current + 5;
        return current + 2;
      });
    }, 260);

    const labelTimeoutId = window.setTimeout(() => {
      setSavePresetProgressLabel(
        pendingPresetSave?.personDescription?.trim()
          ? 'Generating Gemini portrait from the persona description...'
          : 'Finalizing custom preset...'
      );
    }, 700);

    return () => {
      window.clearInterval(intervalId);
      window.clearTimeout(labelTimeoutId);
    };
  }, [isSavingPreset, pendingPresetSave]);

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

    const handleRegenerateHeadshot = async (id: number) => {
      await apiRegeneratePresetImage(id);
      refreshPresets();
      showToast('Headshot regenerated', 'success');
    };

  const handlePresetInlineEdit = async (id: number, data: { name?: string; system_instruction?: string }) => {
    await apiUpdatePreset(id, data);
    refreshPresets();
    showToast('Preset updated', 'success');
  };

  /** Open the save dialog for a new custom voice preset from the AI result preview. */
  const handleSavePreset = (data: PendingPresetSave) => {
    setPendingPresetSave(data);
    setPendingPresetName(buildSuggestedPresetName(data));
    setPendingPresetError(null);
    setSavePresetProgress(0);
    setSavePresetProgressLabel('Ready to save preset');
  };

  const resetSavePresetDialog = () => {
    setPendingPresetSave(null);
    setPendingPresetName('');
    setPendingPresetError(null);
    setSavePresetProgress(0);
    setSavePresetProgressLabel('Ready to save preset');
  };

  const handleCloseSavePresetDialog = () => {
    if (isSavingPreset) return;
    resetSavePresetDialog();
  };

  /** Persist the pending preset and return the user to the custom presets view. */
  const handleConfirmSavePreset = async () => {
    if (!pendingPresetSave) return;

    const name = pendingPresetName.trim();
    if (!name) {
      setPendingPresetError('Preset name is required.');
      return;
    }

    setIsSavingPreset(true);
    setPendingPresetError(null);
    try {
      const personDescription = pendingPresetSave.personDescription?.trim();
      await apiCreatePreset({
        name,
        voice_name: pendingPresetSave.voiceName,
        system_instruction: pendingPresetSave.systemInstruction,
        sample_text: pendingPresetSave.text,
        audio_base64: pendingPresetSave.audioBase64 || undefined,
        source_query: pendingPresetSave.sourceQuery,
        generate_headshot: !!personDescription,
        person_description: personDescription || undefined,
      });
      setSavePresetProgress(100);
      setSavePresetProgressLabel(personDescription ? 'Gemini portrait generated. Returning to presets...' : 'Preset saved. Returning to presets...');
      refreshPresets();
      setVoiceTab('custom');
      setActiveSection('presets');
      resetSavePresetDialog();
      clearAiResult();
      showToast(`Preset "${name}" saved`, 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to save preset.';
      if (msg.includes('UNIQUE')) {
        setPendingPresetError(`A preset named "${name}" already exists.`);
      } else {
        setPendingPresetError(msg);
      }
      showToast(msg.includes('UNIQUE') ? `A preset named "${name}" already exists` : msg, msg.includes('UNIQUE') ? 'warning' : 'error');
    } finally {
      setIsSavingPreset(false);
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

  const isModalOpen = showVoiceFinder || showSettings || showShortcuts || showCommandPalette || (aiResult && isAiCardVisible) || !!editingPreset || !!pendingPresetSave;

  /** Handle section change from sidebar. Map presets section to voiceTab='custom'. */
  const handleSectionChange = useCallback((section: AppSection) => {
    setActiveSection(section);
    if (section === 'voices') setVoiceTab('stock');
    if (section === 'presets') setVoiceTab('custom');
  }, []);

  /** Render the Voices section content. */
  const renderVoicesSection = () => (
    <>
      <FilterBar 
        filters={filters}
        onFilterChange={setFilters}
        uniqueGenders={uniqueGenders}
        uniquePitches={uniquePitches}
        onAiCasting={() => setShowVoiceFinder(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeSection="voices"
        gridDensity={gridDensity}
        onGridDensityChange={setGridDensity}
      />
      <main className="flex-1 relative flex flex-col overflow-hidden">
        {filteredVoices.length > 0 ? (
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
                gridDensity={gridDensity}
                voiceBadges={voiceBadges}
                hoverPreview
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
        
        {!aiResult && filteredVoices.length > 0 && viewMode === 'carousel' && (
          <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium tracking-widest uppercase bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm inline-block px-3 py-1 rounded-full border border-white/50 dark:border-zinc-800">
              {activeIndex + 1} / {filteredVoices.length}
            </p>
          </div>
        )}
      </main>
    </>
  );

  /** Render the Presets section content. */
  const renderPresetsSection = () => (
    <>
      <FilterBar 
        filters={filters}
        onFilterChange={setFilters}
        uniqueGenders={uniqueGenders}
        uniquePitches={uniquePitches}
        onAiCasting={() => setShowVoiceFinder(true)}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        activeSection="presets"
        gridDensity={gridDensity}
        onGridDensityChange={setGridDensity}
      />
      <main className="flex-1 relative flex flex-col overflow-hidden">
        {customPresets.length > 0 ? (
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
                onAiCasting={() => setShowVoiceFinder(true)}
                onExport={handleExportPresets}
                onImport={handleImportPresets}
                onInlineEdit={handlePresetInlineEdit}
                onReorder={handleReorderPresets}
                gridDensity={gridDensity}
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
              onAiCasting={() => setShowVoiceFinder(true)}
              onExport={handleExportPresets}
              onImport={handleImportPresets}
              onInlineEdit={handlePresetInlineEdit}
              onReorder={handleReorderPresets}
              gridDensity={gridDensity}
            />
          </div>
        )}
        
        {customPresets.length > 0 && viewMode === 'carousel' && (
          <div className="absolute bottom-6 left-0 right-0 text-center pointer-events-none">
            <p className="text-xs text-zinc-400 dark:text-zinc-500 font-medium tracking-widest uppercase bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm inline-block px-3 py-1 rounded-full border border-white/50 dark:border-zinc-800">
              {activePresetIndex + 1} / {customPresets.length}
            </p>
          </div>
        )}
      </main>
    </>
  );

  return (
    <div className="h-screen w-screen bg-[#FDFDFD] dark:bg-[#09090b] text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden flex relative transition-colors duration-300">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
          <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-blue-50 dark:bg-blue-900/20 blur-3xl opacity-60"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-purple-50 dark:bg-purple-900/20 blur-3xl opacity-50"></div>
      </div>

      {/* Navigation Sidebar (desktop) / Bottom Tab Bar (mobile) */}
      <NavigationSidebar
        activeSection={activeSection}
        onSectionChange={handleSectionChange}
        onOpenSettings={() => setShowSettings(true)}
        onAiCasting={() => setShowVoiceFinder(true)}
        isDarkMode={isDarkMode}
        toggleTheme={toggleTheme}
        customPresetCount={customPresets.length}
        accentColor={accentColor}
        onAccentChange={setAccentColor}
        highContrast={highContrast}
        onHighContrastChange={setHighContrast}
        onOpenJobCenter={() => setShowJobCenter(true)}
        jobBadgeCount={jobBadgeCount}
        hasActiveJob={hasActiveJob}
        activeJobPercent={activeJobPercent}
      />

      {/* Main Content Area */}
      <div 
        className="flex flex-col flex-1 overflow-hidden pb-14 xl:pb-0 relative"
        aria-hidden={isModalOpen}
        // @ts-ignore - 'inert' is a standard attribute but might not be in all TS types yet
        inert={isModalOpen ? '' : undefined}
        style={isModalOpen ? { pointerEvents: 'none' } : {}}
      >
        {activeSection === 'voices' && renderVoicesSection()}
        {activeSection === 'presets' && renderPresetsSection()}
        {activeSection === 'script' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <ProjectWorkspace
              voices={VOICE_DATA}
              customPresets={customPresets}
              initialVoiceName={scriptVoiceName}
              onClose={() => setActiveSection('voices')}
              inline
            />
          </div>
        )}
        {activeSection === 'scriptreader' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <ScriptReaderModal
              voices={VOICE_DATA}
              customPresets={customPresets}
              initialVoiceName={scriptVoiceName}
              onClose={() => setActiveSection('voices')}
              inline
            />
          </div>
        )}
        {activeSection === 'history' && (
          <div className="flex-1 overflow-hidden flex flex-col">
            <HistoryPanel 
              onClose={() => setActiveSection('voices')}
              inline
            />
          </div>
        )}
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
                    setActiveSection('voices');
                }
                setShowVoiceFinder(false);
            }}
            onClose={() => setShowVoiceFinder(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          isDarkMode={isDarkMode}
          onToggleDark={toggleTheme}
          accentColor={accentColor}
          onAccentChange={setAccentColor}
          highContrast={highContrast}
          onHighContrastChange={setHighContrast}
        />
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
          onRegenerateHeadshot={handleRegenerateHeadshot}
        />
      )}

      {pendingPresetSave && (
        <SavePresetDialog
          voiceName={pendingPresetSave.voiceName}
          presetName={pendingPresetName}
          suggestedName={buildSuggestedPresetName(pendingPresetSave)}
          sourceQuery={pendingPresetSave.sourceQuery}
          personDescription={pendingPresetSave.personDescription}
          isSaving={isSavingPreset}
          progress={savePresetProgress}
          progressLabel={savePresetProgressLabel}
          error={pendingPresetError}
          onNameChange={setPendingPresetName}
          onClose={handleCloseSavePresetDialog}
          onSave={handleConfirmSavePreset}
        />
      )}

      {showShortcuts && (
        <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {/* Floating mini-player */}
      {!isModalOpen && <JobCenter open={showJobCenter} onClose={() => setShowJobCenter(false)} />}
      <MiniPlayer />

      {/* Command palette */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={handleSectionChange}
        onSelectVoice={(name) => {
          const idx = filteredVoices.findIndex(v => v.name === name);
          if (idx >= 0) { setActiveIndex(idx); setActiveSection('voices'); }
        }}
        onToggleTheme={toggleTheme}
        onOpenSettings={() => setShowSettings(true)}
        onOpenVoiceFinder={() => setShowVoiceFinder(true)}
        isDarkMode={isDarkMode}
        voices={VOICE_DATA}
        customPresets={customPresets}
        viewMode={viewMode}
        onToggleView={() => setViewMode(v => v === 'carousel' ? 'grid' : 'carousel')}
      />

      {/* Onboarding tour */}
      <OnboardingTour />

    </div>
  );
};

export default App;
