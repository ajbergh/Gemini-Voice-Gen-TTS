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

import React, { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CustomPreset, GridDensity } from '../types';
import { Sparkles, Download, Upload, GripVertical } from 'lucide-react';
import PresetCard from './PresetCard';

interface PresetGridProps {
  presets: CustomPreset[];
  playingPresetId: number | null;
  onPlayToggle: (presetId: number) => void;
  onEdit: (preset: CustomPreset) => void;
  onDelete: (preset: CustomPreset) => void;
  onDuplicate?: (preset: CustomPreset) => void;
  onAiCasting: () => void;
  onBrowseVoices?: () => void;
  onExport?: () => void;
  onImport?: (file: File) => void;
  onInlineEdit?: (id: number, data: { name?: string; system_instruction?: string }) => Promise<void>;
  onReorder?: (orderedIds: number[]) => void;
  gridDensity?: GridDensity;
}

const presetGridClasses: Record<GridDensity, string> = {
  compact: 'grid-cols-2 sm:grid-cols-3 md:landscape:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3',
  comfortable: 'grid-cols-1 sm:grid-cols-2 md:landscape:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6',
  spacious: 'grid-cols-1 sm:grid-cols-2 md:landscape:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8',
};

/** Render the saved-preset grid with playback, import/export, and reorder actions. */
const PresetGrid: React.FC<PresetGridProps> = ({ presets, playingPresetId, onPlayToggle, onEdit, onDelete, onDuplicate, onAiCasting, onBrowseVoices, onExport, onImport, onInlineEdit, onReorder, gridDensity = 'comfortable' }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOverId, setDragOverId] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);

  const handleDragStart = useCallback((e: React.DragEvent, presetId: number) => {
    dragItemRef.current = presetId;
    e.dataTransfer.effectAllowed = 'move';
    // Make drag image semi-transparent
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '0.5';
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const el = e.currentTarget as HTMLElement;
    el.style.opacity = '1';
    setDragOverId(null);
    dragItemRef.current = null;
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, presetId: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverId(presetId);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, targetId: number) => {
    e.preventDefault();
    setDragOverId(null);
    const sourceId = dragItemRef.current;
    if (sourceId == null || sourceId === targetId || !onReorder) return;

    const ids = presets.map(p => p.id);
    const sourceIdx = ids.indexOf(sourceId);
    const targetIdx = ids.indexOf(targetId);
    if (sourceIdx === -1 || targetIdx === -1) return;

    // Move source to target position
    ids.splice(sourceIdx, 1);
    ids.splice(targetIdx, 0, sourceId);
    onReorder(ids);
  }, [presets, onReorder]);
  if (presets.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center pb-24">
        <div className="text-center animate-fade-in max-w-sm">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 mb-6 shadow-sm">
            <Sparkles size={32} className="text-indigo-400 dark:text-indigo-500" />
          </div>
          <h3 className="text-xl font-serif text-zinc-900 dark:text-white mb-2">No custom voices yet</h3>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 text-sm">
            Star voices you want to revisit, or save an AI Casting result to build your collection.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={onBrowseVoices}
              className="px-5 py-2.5 bg-zinc-900 dark:bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors shadow-md"
            >
              Browse voices
            </button>
            <button
              onClick={onAiCasting}
              className="px-5 py-2.5 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-full text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
            >
              Open AI Casting
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
        {/* Import/Export toolbar */}
        {(onExport || onImport) && (
          <div className="flex items-center justify-end gap-2 mb-4">
            {onImport && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onImport(file);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                >
                  <Upload size={12} />
                  Import
                </button>
              </>
            )}
            {onExport && presets.length > 0 && (
              <button
                onClick={onExport}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                <Download size={12} />
                Export
              </button>
            )}
          </div>
        )}
        <div className={`grid ${presetGridClasses[gridDensity]}`}>
          <AnimatePresence mode="popLayout">
            {presets.map(preset => (
              <motion.div
                key={preset.id}
                layout
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
              >
                <div
                  className={`relative ${dragOverId === preset.id ? 'ring-2 ring-indigo-400 dark:ring-indigo-500 rounded-2xl' : ''}`}
                  draggable={!!onReorder}
                  onDragStart={e => handleDragStart(e, preset.id)}
                  onDragEnd={handleDragEnd}
                  onDragOver={e => handleDragOver(e, preset.id)}
                  onDrop={e => handleDrop(e, preset.id)}
                  onDragLeave={() => setDragOverId(null)}
                >
                  {onReorder && (
                    <div className="absolute -left-1 top-1/2 -translate-y-1/2 z-30 cursor-grab active:cursor-grabbing p-1 text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 transition-opacity opacity-0 hover:opacity-100"
                    >
                      <GripVertical size={14} />
                    </div>
                  )}
                  <PresetCard
                    preset={preset}
                    isPlaying={playingPresetId === preset.id}
                    onPlayToggle={onPlayToggle}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onDuplicate={onDuplicate}
                    onInlineEdit={onInlineEdit}
                  />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
        
        {/* Spacer for bottom control bar */}
        <div className="h-32"></div>
      </div>
    </div>
  );
};

export default PresetGrid;
