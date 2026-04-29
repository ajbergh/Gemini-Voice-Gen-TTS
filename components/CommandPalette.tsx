/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * CommandPalette.tsx — Quick-Action Command Palette (Ctrl+K)
 *
 * A searchable overlay for power-user workflows: switch voices, navigate
 * sections, toggle settings, and trigger actions without leaving the keyboard.
 */

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Search, Mic, User, FileText, Clock, Settings, Sun, Moon, Sparkles, ArrowRight, LayoutGrid, RotateCcw } from 'lucide-react';
import { AppSection } from './NavigationSidebar';
import { Voice, CustomPreset } from '../types';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  category: 'navigation' | 'voice' | 'preset' | 'action';
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: AppSection) => void;
  onSelectVoice: (voiceName: string) => void;
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenVoiceFinder: () => void;
  isDarkMode: boolean;
  voices: Voice[];
  customPresets: CustomPreset[];
  viewMode: 'carousel' | 'grid';
  onToggleView: () => void;
}

/** Render the keyboard-driven command palette for navigation and app actions. */
const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  onNavigate,
  onSelectVoice,
  onToggleTheme,
  onOpenSettings,
  onOpenVoiceFinder,
  isDarkMode,
  voices,
  customPresets,
  viewMode,
  onToggleView,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Build command list
  const commands = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      // Navigation
      { id: 'nav-voices', label: 'Go to Voices', description: 'Browse stock voice library', icon: <Mic size={16} />, category: 'navigation', action: () => { onNavigate('voices'); onClose(); } },
      { id: 'nav-presets', label: 'Go to My Voices', description: 'Custom voice presets', icon: <User size={16} />, category: 'navigation', action: () => { onNavigate('presets'); onClose(); } },
      { id: 'nav-script', label: 'Go to Script Reader', description: 'Test scripts with voices', icon: <FileText size={16} />, category: 'navigation', action: () => { onNavigate('script'); onClose(); } },
      { id: 'nav-history', label: 'Go to History', description: 'View generation history', icon: <Clock size={16} />, category: 'navigation', action: () => { onNavigate('history'); onClose(); } },
      // Actions
      { id: 'action-finder', label: 'AI Casting Director', description: 'Find the perfect voice with AI', icon: <Sparkles size={16} />, category: 'action', action: () => { onOpenVoiceFinder(); onClose(); } },
      { id: 'action-theme', label: isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode', icon: isDarkMode ? <Sun size={16} /> : <Moon size={16} />, category: 'action', action: () => { onToggleTheme(); onClose(); } },
      { id: 'action-view', label: viewMode === 'carousel' ? 'Switch to Grid View' : 'Switch to Carousel View', icon: viewMode === 'carousel' ? <LayoutGrid size={16} /> : <RotateCcw size={16} />, category: 'action', action: () => { onToggleView(); onClose(); } },
      { id: 'action-settings', label: 'Open Settings', description: 'API key & preferences', icon: <Settings size={16} />, category: 'action', action: () => { onOpenSettings(); onClose(); } },
    ];

    // Add voice items
    voices.forEach(v => {
      items.push({
        id: `voice-${v.name}`,
        label: v.name,
        description: `${v.analysis.gender} · ${v.analysis.pitch} · ${v.characteristics}`,
        icon: <Mic size={16} />,
        category: 'voice',
        action: () => { onSelectVoice(v.name); onClose(); },
      });
    });

    // Add preset items
    customPresets.forEach(p => {
      items.push({
        id: `preset-${p.id}`,
        label: p.name,
        description: `Custom preset · ${p.voice_name}`,
        icon: <User size={16} />,
        category: 'preset',
        action: () => { onNavigate('presets'); onClose(); },
      });
    });

    return items;
  }, [voices, customPresets, isDarkMode, viewMode, onNavigate, onClose, onSelectVoice, onToggleTheme, onOpenSettings, onOpenVoiceFinder, onToggleView]);

  // Filter commands by query
  const filtered = useMemo(() => {
    if (!query.trim()) return commands.filter(c => c.category === 'navigation' || c.category === 'action');
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q))
    ).slice(0, 20);
  }, [commands, query]);

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keep selected index in bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [filtered.length]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      filtered[selectedIndex]?.action();
    } else if (e.key === 'Escape') {
      onClose();
    }
  }, [filtered, selectedIndex, onClose]);

  if (!isOpen) return null;

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case 'navigation': return 'Navigate';
      case 'voice': return 'Voices';
      case 'preset': return 'Presets';
      case 'action': return 'Actions';
      default: return cat;
    }
  };

  // Group by category for display
  let lastCategory = '';

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm animate-fade-in" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden animate-slide-down"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
          <Search size={16} className="text-zinc-400 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search commands, voices, presets..."
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-500 outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={filtered[selectedIndex]?.id}
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 dark:text-zinc-500 bg-zinc-100 dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2" role="listbox" id="command-palette-list">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
              No matching commands
            </div>
          ) : (
            filtered.map((item, idx) => {
              const showHeader = item.category !== lastCategory;
              lastCategory = item.category;
              return (
                <React.Fragment key={item.id}>
                  {showHeader && (
                    <div className="px-4 pt-2 pb-1 text-[10px] font-bold tracking-wider uppercase text-zinc-400 dark:text-zinc-500">
                      {categoryLabel(item.category)}
                    </div>
                  )}
                  <button
                    data-index={idx}
                    id={item.id}
                    onClick={item.action}
                    role="option"
                    aria-selected={idx === selectedIndex}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                      idx === selectedIndex
                        ? 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300'
                        : 'text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <span className="flex-shrink-0 text-zinc-400 dark:text-zinc-500">{item.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">{item.label}</span>
                      {item.description && (
                        <span className="text-xs text-zinc-400 dark:text-zinc-500 truncate block">{item.description}</span>
                      )}
                    </div>
                    {idx === selectedIndex && <ArrowRight size={12} className="flex-shrink-0 text-indigo-400" />}
                  </button>
                </React.Fragment>
              );
            })
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center gap-4 text-[10px] text-zinc-400 dark:text-zinc-500">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">↵</kbd> select</span>
          <span><kbd className="font-mono">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
