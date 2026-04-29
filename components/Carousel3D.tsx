/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Carousel3D.tsx — 3D Perspective Voice Carousel
 *
 * Displays voices in a 3D perspective carousel powered by Framer Motion.
 * Supports keyboard navigation (ArrowLeft/ArrowRight, Enter/Space to play),
 * drag gestures for swiping between cards, and responsive card spacing that
 * adapts to viewport width. Each card shows the voice image, name, metadata,
 * a play/pause button, and an AudioVisualizer when active.
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { Voice } from '../types';
import { Play, Pause, ChevronLeft, ChevronRight } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';

interface Carousel3DProps {
  voices: Voice[];
  activeIndex: number;
  onChange: (index: number) => void;
  playingVoice: string | null;
  onPlayToggle: (voiceName: string) => void;
  disabled?: boolean;
}

/** Render the interactive 3D-style stock voice carousel. */
const Carousel3D: React.FC<Carousel3DProps> = ({ 
  voices, 
  activeIndex, 
  onChange,
  playingVoice,
  onPlayToggle,
  disabled = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        
        if (playingVoice) {
            const voice = voices.find(v => v.name === playingVoice);
            if (voice) {
                audioRef.current.src = voice.audioSampleUrl;
                audioRef.current.play().catch(e => console.error("Playback failed", e));
            }
        }
    }
  }, [playingVoice, voices]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        // Only trigger if no modal is open
        if (disabled) return;
        
        if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

        if (e.key === 'ArrowLeft') {
            handlePrev();
        } else if (e.key === 'ArrowRight') {
            handleNext();
        } else if (e.key === 'Enter' || e.key === ' ') {
            // Play active
            onPlayToggle(voices[activeIndex].name);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, voices, disabled]);

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (disabled) return;
    const threshold = 50;
    if (info.offset.x > threshold && activeIndex > 0) {
      onChange(activeIndex - 1);
    } else if (info.offset.x < -threshold && activeIndex < voices.length - 1) {
      onChange(activeIndex + 1);
    }
  };

  const handlePrev = () => {
    if (activeIndex > 0) onChange(activeIndex - 1);
  };

  const handleNext = () => {
    if (activeIndex < voices.length - 1) onChange(activeIndex + 1);
  };

  const handleAudioEnded = () => {
     if (playingVoice) onPlayToggle(playingVoice);
  };

  const visibleRange = 3; 

  return (
    <div className="relative w-full h-full flex items-center justify-center">
      
      <audio ref={audioRef} onEnded={handleAudioEnded} preload="none" />

      {/* Navigation Arrows */}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-between px-4 sm:px-12 z-50 pointer-events-none">
        <button 
            onClick={handlePrev}
            disabled={activeIndex === 0 || disabled}
            className={`p-4 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md shadow-lg border border-white/50 dark:border-zinc-700/50 text-zinc-800 dark:text-zinc-200 transition-all hover:scale-110 active:scale-95 pointer-events-auto ${activeIndex === 0 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-white dark:hover:bg-zinc-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="Previous voice"
        >
            <ChevronLeft size={24} />
        </button>
        <button 
            onClick={handleNext}
            disabled={activeIndex === voices.length - 1 || disabled}
            className={`p-4 rounded-full bg-white/80 dark:bg-zinc-800/80 backdrop-blur-md shadow-lg border border-white/50 dark:border-zinc-700/50 text-zinc-800 dark:text-zinc-200 transition-all hover:scale-110 active:scale-95 pointer-events-auto ${activeIndex === voices.length - 1 ? 'opacity-0 cursor-default' : 'opacity-100 hover:bg-white dark:hover:bg-zinc-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            aria-label="Next voice"
        >
            <ChevronRight size={24} />
        </button>
      </div>

      <div 
        ref={containerRef} 
        className="relative w-full h-[70vh] md:landscape:h-[55vh] lg:landscape:h-[65vh] flex items-center justify-center"
        style={{ perspective: '1200px' }}
      >
        <div className="relative w-full h-full flex items-center justify-center transform-style-3d">
          <AnimatePresence initial={false}>
            {voices.map((voice, index) => {
              if (Math.abs(index - activeIndex) > visibleRange) return null;

              const isActive = index === activeIndex;
              const offset = index - activeIndex;
              const isPlaying = playingVoice === voice.name;
              
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
                  key={voice.name}
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
                          onPlayToggle(voice.name);
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
                  aria-label={`Voice card for ${voice.name}. ${isActive ? 'Press Enter to play.' : 'Click to select.'}`}
                >
                  {/* Fader Overlay for Inactive Cards */}
                  <motion.div 
                    animate={{ opacity: isActive ? 0 : 0.6 }}
                    className="absolute inset-0 bg-white dark:bg-zinc-900 z-40 pointer-events-none"
                  />

                  <div className="h-full flex flex-col relative">
                      <div className="flex-1 relative bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center overflow-hidden">
                          {/* Voice headshot image */}
                          <img
                            src={`/images/${voice.name}.png`}
                            alt={voice.name}
                            className="absolute inset-0 w-full h-full object-cover object-top"
                            loading="lazy"
                            draggable={false}
                          />
                          {/* Subtle gradient overlay for depth */}
                          <div className="absolute inset-0 bg-gradient-to-t from-white/40 via-transparent to-transparent dark:from-zinc-800/60 dark:via-transparent dark:to-transparent pointer-events-none" />

                          {/* Audio visualizer overlay when playing */}
                          <div className={`absolute inset-0 z-10 transition-opacity duration-500 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
                              <div className="absolute inset-0 bg-black/30 dark:bg-black/50" />
                              <AudioVisualizer isPlaying={isPlaying} color={document.documentElement.classList.contains('dark') ? '#a5b4fc' : '#ffffff'} />
                          </div>

                          {/* Play/pause hover overlay */}
                          <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-200">
                               <div className="w-20 h-20 rounded-full bg-zinc-900/70 dark:bg-white/80 backdrop-blur-md flex items-center justify-center shadow-xl transform transition-transform active:scale-95">
                                  {isPlaying ? (
                                      <Pause size={32} className="text-white dark:text-zinc-900 fill-current" />
                                  ) : (
                                      <Play size={32} className="text-white dark:text-zinc-900 fill-current ml-1" />
                                  )}
                               </div>
                          </div>
                          
                          {isPlaying && (
                              <div className="absolute top-6 right-6 w-3 h-3 rounded-full animate-google-colors z-20"></div>
                          )}
                      </div>

                      <div className="h-[40%] p-8 flex flex-col justify-between bg-white dark:bg-zinc-800 relative z-30">
                          <div>
                              <div className="flex items-center justify-between mb-2">
                                  <h2 className="text-4xl font-serif text-zinc-900 dark:text-white tracking-tight">{voice.name}</h2>
                                  <div className="flex gap-2">
                                      <span className="px-2.5 py-1 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 text-xs font-medium border border-zinc-200 dark:border-zinc-600">
                                          {voice.analysis.gender}
                                      </span>
                                  </div>
                              </div>
                              <div className="flex flex-wrap gap-2 mb-4">
                                  <span className="text-sm text-zinc-500 dark:text-zinc-400 font-light">{voice.pitch} Pitch</span>
                                  <span className="text-zinc-300 dark:text-zinc-600">•</span>
                                  <span className="text-sm text-zinc-500 dark:text-zinc-400 font-light">{voice.analysis.characteristics[0]}</span>
                              </div>
                          </div>
                          
                          <div className="space-y-3">
                              <div className="w-full h-px bg-zinc-100 dark:bg-zinc-700"></div>
                              <p className="text-sm text-zinc-400 dark:text-zinc-500 font-light leading-relaxed line-clamp-2">
                                  {voice.analysis.characteristics.join(', ')}
                              </p>
                          </div>
                      </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* Pagination dots */}
      {voices.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10">
          {voices.length <= 15 ? (
            voices.map((_, idx) => (
              <button
                key={idx}
                onClick={() => !disabled && onChange(idx)}
                disabled={disabled}
                className={`rounded-full transition-all duration-300 ${
                  idx === activeIndex
                    ? 'w-6 h-2 accent-bg'
                    : 'w-2 h-2 bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500'
                }`}
                aria-label={`Go to voice ${idx + 1}`}
                aria-current={idx === activeIndex ? 'true' : undefined}
              />
            ))
          ) : (
            /* For large sets, show a window of dots around the active index */
            (() => {
              const windowSize = 9;
              const half = Math.floor(windowSize / 2);
              let start = Math.max(0, activeIndex - half);
              let end = Math.min(voices.length, start + windowSize);
              if (end - start < windowSize) start = Math.max(0, end - windowSize);
              const dots = [];
              if (start > 0) dots.push(<span key="start-ellipsis" className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />);
              for (let i = start; i < end; i++) {
                const distance = Math.abs(i - activeIndex);
                const scale = distance === 0 ? 1 : distance <= 1 ? 0.85 : 0.65;
                dots.push(
                  <button
                    key={i}
                    onClick={() => !disabled && onChange(i)}
                    disabled={disabled}
                    className={`rounded-full transition-all duration-300 ${
                      i === activeIndex
                        ? 'w-6 h-2 accent-bg'
                        : 'w-2 h-2 bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500'
                    }`}
                    style={{ transform: `scale(${scale})` }}
                    aria-label={`Go to voice ${i + 1}`}
                    aria-current={i === activeIndex ? 'true' : undefined}
                  />
                );
              }
              if (end < voices.length) dots.push(<span key="end-ellipsis" className="w-1 h-1 rounded-full bg-zinc-300 dark:bg-zinc-600" />);
              return dots;
            })()
          )}
        </div>
      )}
    </div>
  );
};

export default Carousel3D;
