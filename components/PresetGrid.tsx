/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PresetGrid.tsx — Responsive Grid Layout for Custom Voice Presets
 *
 * Displays user-created voice presets in a responsive grid (1→2→3→4 columns).
 * When empty, shows an onboarding prompt to create a first preset via the
 * AI Casting Director.
 */

import React from 'react';
import { CustomPreset } from '../types';
import { Sparkles } from 'lucide-react';
import PresetCard from './PresetCard';

interface PresetGridProps {
  presets: CustomPreset[];
  playingPresetId: number | null;
  onPlayToggle: (presetId: number) => void;
  onEdit: (preset: CustomPreset) => void;
  onDelete: (preset: CustomPreset) => void;
  onOpenAiCasting: () => void;
}

const PresetGrid: React.FC<PresetGridProps> = ({ presets, playingPresetId, onPlayToggle, onEdit, onDelete, onOpenAiCasting }) => {
  if (presets.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center pb-24">
        <div className="text-center animate-fade-in max-w-sm">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mb-6 shadow-sm">
            <Sparkles size={32} className="text-indigo-400 dark:text-indigo-500" />
          </div>
          <h3 className="text-xl font-serif text-zinc-900 dark:text-white mb-2">No saved presets yet</h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-sm">
            Use the AI Casting Director to find your perfect voice, then save it as a preset for quick access.
          </p>
          <button
            onClick={onOpenAiCasting}
            className="px-5 py-2.5 bg-zinc-900 dark:bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors shadow-md"
          >
            Open AI Casting Director
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {presets.map(preset => (
            <PresetCard
              key={preset.id}
              preset={preset}
              isPlaying={playingPresetId === preset.id}
              onPlayToggle={onPlayToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
        
        {/* Spacer for bottom control bar */}
        <div className="h-32"></div>
      </div>
    </div>
  );
};

export default PresetGrid;
