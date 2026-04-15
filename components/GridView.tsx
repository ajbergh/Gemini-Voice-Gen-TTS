/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import { Voice } from '../types';
import VoiceCard from './VoiceCard';

interface GridViewProps {
  voices: Voice[];
  playingVoice: string | null;
  onPlayToggle: (voiceName: string) => void;
}

const GridView: React.FC<GridViewProps> = ({ voices, playingVoice, onPlayToggle }) => {
  return (
    <div className="w-full h-full overflow-y-auto scrollbar-hide">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {voices.map((voice) => (
                    <VoiceCard 
                        key={voice.name}
                        voice={voice}
                        isPlaying={playingVoice === voice.name}
                        onPlayToggle={onPlayToggle}
                    />
                ))}
            </div>
            
            {/* Spacer for bottom control bar */}
            <div className="h-32"></div>
        </div>
    </div>
  );
};

export default GridView;