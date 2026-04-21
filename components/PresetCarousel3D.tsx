/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PresetCarousel3D.tsx — 3D Perspective Carousel for Custom Voice Presets
 *
 * Mirrors the stock Carousel3D layout and animations for user-created presets.
 * Supports keyboard navigation (ArrowLeft/ArrowRight, Enter/Space to play),
 * drag gestures, responsive card spacing, and 3D perspective transforms via
 * Framer Motion. Plays cached PCM audio (24kHz/16-bit/mono) through Web Audio
 * API instead of standard HTML audio elements.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { CustomPreset } from '../types';
import { VOICE_DATA } from '../constants';
import { getPresetAudio } from '../api';
import { Play, Pause, Activity, ChevronLeft, ChevronRight, Loader2, Pencil, Trash2, Copy } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';
import PresetArtwork from './PresetArtwork';
import { getPresetHeadshotMetadata } from '../presetMetadata';

interface PresetCarousel3DProps {
  presets: CustomPreset[];
  activeIndex: number;
  onChange: (index: number) => void;
  playingPresetId: number | null;
  onPlayToggle: (presetId: number) => void;
  onEdit: (preset: CustomPreset) => void;
  onDelete: (preset: CustomPreset) => void;
  onDuplicate?: (preset: CustomPreset) => void;
  disabled?: boolean;
}

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const PresetCarousel3D: React.FC<PresetCarousel3DProps> = ({
  presets,
  activeIndex,
  onChange,
  playingPresetId,
  onPlayToggle,
  onEdit,
  onDelete,
  onDuplicate,
  disabled = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isMountedRef = useRef(true);
  const [isLoading, setIsLoading] = useState(false);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    isMountedRef.current = true;
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => {
      isMountedRef.current = false;
      window.removeEventListener('resize', handleResize);
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Stop audio when playingPresetId changes to null or different preset
  useEffect(() => {
    if (!playingPresetId && sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
  }, [playingPresetId]);

  const handlePlayPreset = useCallback(async (preset: CustomPreset) => {
    if (playingPresetId === preset.id) {
      onPlayToggle(preset.id);
      return;
    }

    if (!preset.audio_path) return;

    // Stop current playback
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }

    setIsLoading(true);
    try {
      const audioBase64 = await getPresetAudio(preset.id);
      if (!isMountedRef.current) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const rawBytes = decodeBase64(audioBase64);
      const dataInt16 = new Int16Array(rawBytes.buffer);
      const frameCount = dataInt16.length;
      const buffer = audioContextRef.current.createBuffer(1, frameCount, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) {
        channelData[i] = dataInt16[i] / 32768.0;
      }

      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        if (isMountedRef.current) onPlayToggle(preset.id);
      };
      sourceNodeRef.current = source;
      source.start();
      onPlayToggle(preset.id);
    } catch (err) {
      console.error('Preset playback error:', err);
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [playingPresetId, onPlayToggle]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (disabled) return;
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      } else if (e.key === 'Enter' || e.key === ' ') {
        if (presets[activeIndex]) {
          handlePlayPreset(presets[activeIndex]);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, presets, disabled, handlePlayPreset]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled) return;
    const threshold = 50;
    if (info.offset.x > threshold && activeIndex > 0) {
      onChange(activeIndex - 1);
    } else if (info.offset.x < -threshold && activeIndex < presets.length - 1) {
      onChange(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) onChange(activeIndex - 1);
  };

  const handleNext = () => {
    if (activeIndex < presets.length - 1) onChange(activeIndex + 1);
  };

  const visibleRange = 3;

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      
      {/* Navigation Arrows */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 sm:px-12 z-50 pointer-events-none">
        <button 
          onClick={handlePrev}
          disabled={activeIndex === 0 || disabled}
          className={`p-4 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md shadow-lg border border-white/50 dark:border-zinc-700/50 text-zinc-800 dark:text-zinc-200 transition-all hover:scale-110 active:scale-95 pointer-events-auto ${activeIndex === 0 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-white dark:hover:bg-zinc-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Previous preset"
        >
          <ChevronLeft size={24} />
        </button>
        <button 
          onClick={handleNext}
          disabled={activeIndex === presets.length - 1 || disabled}
          className={`p-4 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md shadow-lg border border-white/50 dark:border-zinc-700/50 text-zinc-800 dark:text-zinc-200 transition-all hover:scale-110 active:scale-95 pointer-events-auto ${activeIndex === presets.length - 1 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-white dark:hover:bg-zinc-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          aria-label="Next preset"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      <div 
        ref={containerRef} 
        className="relative w-full h-[70vh] flex items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        <div className="relative w-full h-full flex items-center justify-center transform-style-3d">
          <AnimatePresence initial={false}>
            {presets.map((preset, index) => {
              if (Math.abs(index - activeIndex) > visibleRange) return null;

              const isActive = index === activeIndex;
              const offset = index - activeIndex;
              const isPlaying = playingPresetId === preset.id;
              const baseVoice = VOICE_DATA.find(v => v.name === preset.voice_name);
              const hasHeadshot = !!getPresetHeadshotMetadata(preset);
              
              const zIndex = 100 - Math.abs(offset);
              const isMobile = windowWidth < 640;
              
              let x = 0;
              if (isMobile) {
                const mobileSpacing = windowWidth * 0.75;
                x = offset * mobileSpacing;
              } else {
                const baseGap = 280;
                const stackStep = 45;
                if (offset !== 0) {
                  x = Math.sign(offset) * (baseGap + (Math.abs(offset) - 1) * stackStep);
                }
              }

              return (
                <motion.div
                  key={preset.id}
                  className={`absolute w-[300px] sm:w-[360px] aspect-[3/4] bg-white dark:bg-zinc-800 rounded-3xl border border-zinc-100 dark:border-zinc-700 overflow-hidden cursor-pointer ${isActive ? 'shadow-2xl' : 'shadow-lg'}`}
                  style={{ zIndex }}
                  initial={{ scale: 0.8, opacity: 0, x: offset * 200 }}
                  animate={{ 
                    scale: isActive ? 1 : 0.85, 
                    opacity: 1, 
                    x,
                    z: isActive ? 0 : -100 - (Math.abs(offset) * 30), 
                    rotateY: offset * -15, 
                    filter: isActive ? 'blur(0px)' : 'blur(0.5px)'
                  }}
                  exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  onClick={() => {
                    if (disabled) return;
                    if (isActive) {
                      handlePlayPreset(preset);
                    } else {
                      onChange(index);
                    }
                  }}
                  drag={isActive && !disabled ? "x" : false}
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  onDragEnd={handleDragEnd}
                  whileHover={isActive && !disabled ? { scale: 1.02 } : {}}
                  role="button"
                  tabIndex={isActive && !disabled ? 0 : -1}
                  aria-label={`Preset card for ${preset.name}. ${isActive ? 'Press Enter to play.' : 'Click to select.'}`}
                >
                  {/* Fader Overlay for Inactive Cards */}
                  <motion.div 
                    animate={{ opacity: isActive ? 0 : 0.6 }}
                    className="absolute inset-0 bg-white dark:bg-zinc-900 z-40 pointer-events-none"
                  />

                  <div className="h-full flex flex-col relative">
                    {/* Visualizer Area - Top */}
                    <div className="flex-1 relative bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                      <PresetArtwork
                        presetId={preset.id}
                        hasHeadshot={hasHeadshot}
                        fallbackImageUrl={baseVoice?.imageUrl}
                        alt={preset.name}
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 via-zinc-950/15 to-white/10 dark:from-zinc-950/70 dark:via-zinc-950/25 dark:to-zinc-950/5"></div>
                      <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '12px 12px' }}></div>
                      
                      <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
                        <AudioVisualizer isPlaying={isPlaying} color={document.documentElement.classList.contains('dark') ? '#a5b4fc' : '#18181b'} />
                      </div>

                      <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}>
                        <div className={`w-20 h-20 rounded-full shadow-sm border flex items-center justify-center ${hasHeadshot || baseVoice?.imageUrl ? 'bg-white/85 dark:bg-zinc-800/85 backdrop-blur-sm border-white/50 dark:border-zinc-700/80' : 'bg-white dark:bg-zinc-800 border-zinc-100 dark:border-zinc-700'}`}>
                          {isLoading && isActive ? (
                            <Loader2 size={32} className="text-zinc-300 dark:text-zinc-600 animate-spin" />
                          ) : (
                            <Activity size={32} className="text-zinc-300 dark:text-zinc-600" />
                          )}
                        </div>
                      </div>

                      <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                        <div className="w-20 h-20 rounded-full bg-zinc-900/90 dark:bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-xl transform transition-transform active:scale-95">
                          {isPlaying ? (
                            <Pause size={32} className="text-white dark:text-zinc-900 fill-current" />
                          ) : (
                            <Play size={32} className="text-white dark:text-zinc-900 fill-current ml-1" />
                          )}
                        </div>
                      </div>
                      
                      {isPlaying && (
                        <div className="absolute top-6 right-6 w-3 h-3 rounded-full animate-google-colors"></div>
                      )}

                      {/* Custom Badge */}
                      <div className="absolute top-6 left-6 px-2.5 py-1 bg-indigo-500/90 backdrop-blur-sm text-white text-[10px] font-bold uppercase tracking-wider rounded-full z-30">
                        Custom
                      </div>
                    </div>

                    {/* Info Area - Bottom */}
                    <div className="h-[40%] p-8 flex flex-col justify-between bg-white dark:bg-zinc-800 relative z-30">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h2 className="text-4xl font-serif text-zinc-900 dark:text-white tracking-tight truncate">{preset.name}</h2>
                          <div className="flex gap-2 shrink-0 ml-2">
                            <span className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium border border-zinc-200 dark:border-zinc-600">
                              {preset.voice_name}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 mb-4">
                          {baseVoice && (
                            <>
                              <span className="text-sm text-zinc-500 dark:text-zinc-400 font-light">{baseVoice.analysis.pitch} Pitch</span>
                              <span className="text-zinc-300 dark:text-zinc-600">•</span>
                              <span className="text-sm text-zinc-500 dark:text-zinc-400 font-light">{baseVoice.analysis.gender}</span>
                            </>
                          )}
                          {!preset.audio_path && (
                            <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">No cached audio</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="space-y-3">
                        <div className="w-full h-px bg-zinc-100 dark:bg-zinc-700"></div>
                        {preset.source_query ? (
                          <p className="text-sm text-zinc-400 dark:text-zinc-500 font-light leading-relaxed line-clamp-2 italic">
                            "{preset.source_query}"
                          </p>
                        ) : baseVoice ? (
                          <p className="text-sm text-zinc-400 dark:text-zinc-500 font-light leading-relaxed line-clamp-2">
                            {baseVoice.analysis.characteristics.join(', ')}
                          </p>
                        ) : null}

                        {/* Action Buttons */}
                        {isActive && (
                          <div className="flex gap-1.5 pt-1 relative z-50" onClick={(e) => e.stopPropagation()}>
                            {onDuplicate && (
                              <button
                                onClick={() => onDuplicate(preset)}
                                className="p-1.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600"
                                title="Duplicate preset"
                              >
                                <Copy size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => onEdit(preset)}
                              className="p-1.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors border border-zinc-200 dark:border-zinc-600"
                              title="Edit preset"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() => onDelete(preset)}
                              className="p-1.5 bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors border border-zinc-200 dark:border-zinc-600"
                              title="Delete preset"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default PresetCarousel3D;
