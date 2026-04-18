/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * VoiceCard.tsx — Individual Voice Card (Grid View)
 *
 * Renders a single voice as a card in the grid layout. Shows the voice image,
 * name, gender, pitch, characteristics badges, and a play/pause button with
 * an AudioVisualizer overlay. Uses a standard HTML <audio> element with
 * preload="none" for sample playback.
 */

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { Play, Pause, Star, Sparkles, ChevronDown } from 'lucide-react';
import { Voice } from '../types';
import AudioVisualizer from './AudioVisualizer';

interface VoiceCardProps {
  voice: Voice;
  isPlaying: boolean;
  onPlayToggle: (voiceName: string) => void;
  isFavorite?: boolean;
  onFavoriteToggle?: (voiceName: string) => void;
  onFindSimilar?: (voiceName: string) => void;
  badges?: string[];
  hoverPreview?: boolean;
}

const badgeColors: Record<string, string> = {
  'Popular': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  'AI Pick': 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 border-violet-200 dark:border-violet-800',
  'New': 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
};
const defaultBadgeColor = 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800';

const VoiceCard: React.FC<VoiceCardProps> = ({ voice, isPlaying, onPlayToggle, isFavorite, onFavoriteToggle, onFindSimilar, badges, hoverPreview = false }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hoverAudioRef = useRef<HTMLAudioElement | null>(null);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches;
  const [expanded, setExpanded] = useState(false);

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

  const stopHoverPreview = useCallback(() => {
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
    if (hoverStopTimerRef.current) { clearTimeout(hoverStopTimerRef.current); hoverStopTimerRef.current = null; }
    if (hoverAudioRef.current) {
      hoverAudioRef.current.pause();
      hoverAudioRef.current.currentTime = 0;
    }
  }, []);

  const handleClick = () => {
      stopHoverPreview();
      onPlayToggle(voice.name);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
      }
  };

  const handleMouseEnter = useCallback(() => {
    if (!hoverPreview || !canHover || isPlaying) return;
    hoverTimerRef.current = setTimeout(() => {
      if (!hoverAudioRef.current) {
        hoverAudioRef.current = new Audio(voice.audioSampleUrl);
        hoverAudioRef.current.volume = 0.4;
      }
      hoverAudioRef.current.currentTime = 0;
      hoverAudioRef.current.play().catch(() => {});
      hoverStopTimerRef.current = setTimeout(() => {
        if (hoverAudioRef.current) { hoverAudioRef.current.pause(); hoverAudioRef.current.currentTime = 0; }
      }, 2000);
    }, 400);
  }, [hoverPreview, canHover, isPlaying, voice.audioSampleUrl]);

  useEffect(() => {
    return () => stopHoverPreview();
  }, [stopHoverPreview]);

  return (
    <div 
        className={`group relative bg-white dark:bg-zinc-800 border transition-all duration-200 flex flex-col cursor-pointer rounded-2xl overflow-hidden hover-lift hover:border-zinc-300 dark:hover:border-zinc-600 ${isPlaying ? 'border-blue-200 dark:border-blue-800 ring-2 ring-blue-100 dark:ring-blue-900/30 shadow-md' : 'border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md'}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={stopHoverPreview}
    >
      <div
        className={`flex flex-col sm:flex-row ${expanded ? '' : 'h-auto sm:h-28'}`}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={`Play sample for ${voice.name}`}
    >
      
      {/* Visualizer / Action Area - Left Side */}
      <div className="relative h-20 sm:h-full w-full sm:w-28 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0 border-b sm:border-b-0 sm:border-r border-zinc-100 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
        
        {/* Voice headshot image */}
        <img
          src={`/images/${voice.name}.png`}
          alt={voice.name}
          className="absolute inset-0 w-full h-full object-cover object-top"
          loading="lazy"
          draggable={false}
        />

        {/* Active Visualizer */}
        <div className={`absolute inset-0 z-10 transition-opacity duration-200 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
             <div className="absolute inset-0 bg-black/30 dark:bg-black/50" />
             <AudioVisualizer isPlaying={isPlaying} color={document.documentElement.classList.contains('dark') ? '#a5b4fc' : '#ffffff'} />
        </div>

        {/* Play Button Overlay - Tactile Feel */}
        <div className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${isPlaying ? 'opacity-0 hover:opacity-100 focus:opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'}`}>
            <div className="h-9 w-9 bg-zinc-900/70 dark:bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg transform transition-transform active:scale-95">
                {isPlaying ? <Pause size={14} className="text-white dark:text-zinc-900" fill="currentColor" /> : <Play size={14} className="text-white dark:text-zinc-900 ml-0.5" fill="currentColor" />}
            </div>
        </div>
        
        {/* Status Indicator */}
        <div className={`absolute top-2 left-2 z-20 w-1.5 h-1.5 rounded-full ${isPlaying ? 'animate-google-colors' : 'bg-zinc-200/60 dark:bg-zinc-600/60'}`}></div>
      </div>

      {/* Content Area - Right Side */}
      <div className="flex-1 p-4 flex flex-col justify-center min-w-0 bg-white dark:bg-zinc-800">
        
        {/* Badges */}
        {badges && badges.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1.5">
            {badges.map(badge => (
              <span key={badge} className={`inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider rounded-full border ${badgeColors[badge] || defaultBadgeColor}`}>
                {badge}
              </span>
            ))}
          </div>
        )}

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-medium text-zinc-900 dark:text-white tracking-tight">{voice.name}</h3>
            <div className="flex items-center gap-1">
                {onFavoriteToggle && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onFavoriteToggle(voice.name); }}
                    className={`p-1 rounded-full transition-colors ${isFavorite ? 'text-amber-400 hover:text-amber-500' : 'text-zinc-300 dark:text-zinc-600 hover:text-amber-400 opacity-0 group-hover:opacity-100'}`}
                    aria-label={isFavorite ? `Remove ${voice.name} from favorites` : `Add ${voice.name} to favorites`}
                  >
                    <Star size={14} className={isFavorite ? 'fill-current' : ''} />
                  </button>
                )}
                <span className="inline-flex items-center px-2 py-0.5 border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 rounded-full">
                    {voice.analysis.gender}
                </span>
                <span className="inline-flex items-center px-2 py-0.5 border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 rounded-full">
                    {voice.pitch}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
                  className={`p-0.5 rounded-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
                  aria-label={expanded ? 'Collapse details' : 'Expand details'}
                  aria-expanded={expanded}
                >
                  <ChevronDown size={14} />
                </button>
            </div>
        </div>
        
        {/* Description */}
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2 font-light">
            {voice.analysis.characteristics.join(', ')}
        </p>
        {onFindSimilar && (
          <button
            onClick={(e) => { e.stopPropagation(); onFindSimilar(voice.name); }}
            className="mt-1 flex items-center gap-1 text-[10px] font-medium accent-text hover:opacity-80 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Sparkles size={10} />
            Find similar
          </button>
        )}
      </div>
      </div>

      {/* Expanded Detail Panel */}
      {expanded && (
        <div className="border-t border-zinc-100 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-900/30 px-4 py-3 animate-slide-down">
          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
            <div>
              <span className="font-medium text-zinc-500 dark:text-zinc-400">Gender</span>
              <p className="text-zinc-700 dark:text-zinc-200">{voice.analysis.gender}</p>
            </div>
            <div>
              <span className="font-medium text-zinc-500 dark:text-zinc-400">Pitch</span>
              <p className="text-zinc-700 dark:text-zinc-200">{voice.analysis.pitch}</p>
            </div>
          </div>
          <div className="mb-3">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Characteristics</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {voice.analysis.characteristics.map(c => (
                <span key={c} className="inline-flex px-2 py-0.5 text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 rounded-full border border-zinc-200 dark:border-zinc-700">
                  {c}
                </span>
              ))}
            </div>
          </div>
          {voice.analysis.visualDescription && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 italic leading-relaxed">
              {voice.analysis.visualDescription}
            </p>
          )}
        </div>
      )}

      <audio ref={audioRef} src={voice.audioSampleUrl} onEnded={handleAudioEnded} preload="none" />
    </div>
  );
};

export default VoiceCard;