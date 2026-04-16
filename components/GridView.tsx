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
import { Voice } from '../types';
import VoiceCard from './VoiceCard';

interface GridViewProps {
  voices: Voice[];
  playingVoice: string | null;
  onPlayToggle: (voiceName: string) => void;
  favoriteVoices?: Set<string>;
  onFavoriteToggle?: (voiceName: string) => void;
  onFindSimilar?: (voiceName: string) => void;
}

const GridView: React.FC<GridViewProps> = ({ voices, playingVoice, onPlayToggle, favoriteVoices, onFavoriteToggle, onFindSimilar }) => {
  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
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