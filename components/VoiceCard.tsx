/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useRef, useEffect } from 'react';
import { Play, Pause, Activity } from 'lucide-react';
import { Voice } from '../types';
import AudioVisualizer from './AudioVisualizer';

interface VoiceCardProps {
  voice: Voice;
  isPlaying: boolean;
  onPlayToggle: (voiceName: string) => void;
}

const VoiceCard: React.FC<VoiceCardProps> = ({ voice, isPlaying, onPlayToggle }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(e => console.error("Playback failed", e));
      } else {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
  }, [isPlaying]);

  const handleAudioEnded = () => {
    if (isPlaying) {
      onPlayToggle(voice.name);
    }
  };

  const handleClick = () => {
      onPlayToggle(voice.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
      }
  };

  return (
    <div 
        className={`group relative bg-white dark:bg-zinc-800 border transition-all duration-200 flex flex-col sm:flex-row h-auto sm:h-28 cursor-pointer rounded-2xl overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-600 ${isPlaying ? 'border-blue-200 dark:border-blue-800 ring-2 ring-blue-100 dark:ring-blue-900/30 shadow-md' : 'border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md'}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={`Play sample for ${voice.name}`}
    >
      
      {/* Visualizer / Action Area - Left Side */}
      <div className="relative h-20 sm:h-full w-full sm:w-28 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0 border-b sm:border-b-0 sm:border-r border-zinc-100 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
        
        {/* Technical Grid Background */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '8px 8px' }}></div>

        {/* Resting State Visual */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}>
             <Activity size={20} className="text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
        </div>

        {/* Active Visualizer */}
        <div className={`absolute inset-0 z-10 transition-opacity duration-200 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
             <AudioVisualizer isPlaying={isPlaying} color={document.documentElement.classList.contains('dark') ? '#a5b4fc' : '#18181b'} />
        </div>

        {/* Play Button Overlay - Tactile Feel */}
        <div className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${isPlaying ? 'opacity-0 hover:opacity-100 focus:opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'}`}>
            <div className="h-9 w-9 bg-zinc-900 dark:bg-zinc-100 rounded-full flex items-center justify-center shadow-lg transform transition-transform active:scale-95">
                {isPlaying ? <Pause size={14} className="text-white dark:text-zinc-900" fill="currentColor" /> : <Play size={14} className="text-white dark:text-zinc-900 ml-0.5" fill="currentColor" />}
            </div>
        </div>
        
        {/* Status Indicator */}
        <div className={`absolute top-2 left-2 w-1.5 h-1.5 rounded-full ${isPlaying ? 'animate-google-colors' : 'bg-zinc-200 dark:bg-zinc-600'}`}></div>
      </div>

      {/* Content Area - Right Side */}
      <div className="flex-1 p-4 flex flex-col justify-center min-w-0 bg-white dark:bg-zinc-800">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white tracking-tight">{voice.name}</h3>
            <div className="flex gap-1">
                <span className="inline-flex items-center px-2 py-0.5 border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 rounded-full">
                    {voice.analysis.gender}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 rounded-full">
                    {voice.pitch}
                </span>
            </div>
        </div>
        
        {/* Description */}
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 font-light">
            {voice.analysis.characteristics.join(', ')}
        </p>
      </div>

      <audio ref={audioRef} src={voice.audioSampleUrl} onEnded={handleAudioEnded} preload="none" />
    </div>
  );
};

export default VoiceCard;