/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * GridView.tsx — Responsive Voice Grid Layout
 *
 * Renders voices in a responsive CSS grid (1→2→3→4 columns across breakpoints)
 * using VoiceCard components. Provides a scrollable alternative to the 3D
 * carousel view with a consistent card layout.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Voice, GridDensity } from '../types';
import VoiceCard from './VoiceCard';

interface GridViewProps {
  voices: Voice[];
  playingVoice: string | null;
  onPlayToggle: (voiceName: string) => void;
  favoriteVoices?: Set<string>;
  onFavoriteToggle?: (voiceName: string) => void;
  onFindSimilar?: (voiceName: string) => void;
  gridDensity?: GridDensity;
  voiceBadges?: Map<string, string[]>;
  hoverPreview?: boolean;
}

const gridClasses: Record<GridDensity, string> = {
  compact: 'grid-cols-2 sm:grid-cols-3 md:landscape:grid-cols-4 lg:grid-cols-4 xl:grid-cols-5 gap-3',
  comfortable: 'grid-cols-1 sm:grid-cols-2 md:landscape:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6',
  spacious: 'grid-cols-1 sm:grid-cols-2 md:landscape:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8',
};

const GridView: React.FC<GridViewProps> = ({ voices, playingVoice, onPlayToggle, favoriteVoices, onFavoriteToggle, onFindSimilar, gridDensity = 'comfortable', voiceBadges, hoverPreview }) => {
  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 md:landscape:py-20">
            <div className={`grid ${gridClasses[gridDensity]}`}>
                <AnimatePresence mode="popLayout">
                  {voices.map((voice) => (
                    <motion.div
                        key={voice.name}
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                    >
                      <VoiceCard 
                          voice={voice}
                          isPlaying={playingVoice === voice.name}
                          onPlayToggle={onPlayToggle}
                          isFavorite={favoriteVoices?.has(voice.name) ?? false}
                          onFavoriteToggle={onFavoriteToggle}
                          onFindSimilar={onFindSimilar}
                          badges={voiceBadges?.get(voice.name)}
                          hoverPreview={hoverPreview}
                      />
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

export default GridView;