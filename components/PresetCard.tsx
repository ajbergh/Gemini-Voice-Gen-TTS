/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * PresetCard.tsx — Individual Custom Voice Preset Card (Grid View)
 *
 * Displays a saved voice preset in a horizontal card layout that mirrors the
 * stock VoiceCard design. Left side has a visualizer/activity area; right side
 * shows preset name, base voice badge, pitch, and source query. Action buttons
 * (use, edit, delete) appear on hover. Audio playback uses Web Audio API with
 * the same 24kHz/16-bit/mono PCM format as the main TTS preview.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Activity, Loader2, Pencil, Trash2 } from 'lucide-react';
import { CustomPreset } from '../types';
import { VOICE_DATA } from '../constants';
import { getPresetAudio } from '../api';
import AudioVisualizer from './AudioVisualizer';

interface PresetCardProps {
  preset: CustomPreset;
  isPlaying: boolean;
  onPlayToggle: (presetId: number) => void;
  onEdit: (preset: CustomPreset) => void;
  onDelete: (preset: CustomPreset) => void;
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

const PresetCard: React.FC<PresetCardProps> = ({ preset, isPlaying, onPlayToggle, onEdit, onDelete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isMountedRef = useRef(true);

  const baseVoice = VOICE_DATA.find(v => v.name === preset.voice_name);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch (e) {}
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!isPlaying && sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
  }, [isPlaying]);

  const handlePlay = async () => {
    if (isPlaying) {
      onPlayToggle(preset.id);
      return;
    }

    if (!preset.audio_path) return;
    
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
  };

  const handleClick = () => {
    if (preset.audio_path && !isLoading) {
      handlePlay();
    }
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
      aria-label={`Play preset ${preset.name}`}
    >
      
      {/* Visualizer / Action Area - Left Side */}
      <div className="relative h-20 sm:h-full w-full sm:w-28 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0 border-b sm:border-b-0 sm:border-r border-zinc-100 dark:border-zinc-700 flex items-center justify-center overflow-hidden">
        
        {/* Technical Grid Background */}
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '8px 8px' }}></div>

        {/* Resting State Visual */}
        <div className={`absolute inset-0 flex items-center justify-center transition-opacity duration-200 ${isPlaying ? 'opacity-0' : 'opacity-100'}`}>
          {isLoading ? (
            <Loader2 size={20} className="text-zinc-300 dark:text-zinc-600 animate-spin" />
          ) : (
            <Activity size={20} className="text-zinc-300 dark:text-zinc-600" strokeWidth={1.5} />
          )}
        </div>

        {/* Active Visualizer */}
        <div className={`absolute inset-0 z-10 transition-opacity duration-200 ${isPlaying ? 'opacity-100' : 'opacity-0'}`}>
          <AudioVisualizer isPlaying={isPlaying} color={document.documentElement.classList.contains('dark') ? '#a5b4fc' : '#18181b'} />
        </div>

        {/* Play Button Overlay */}
        <div className={`absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200 ${isPlaying ? 'opacity-0 hover:opacity-100 focus:opacity-100' : 'opacity-0 group-hover:opacity-100 group-focus:opacity-100'}`}>
          <div className="h-9 w-9 bg-zinc-900 dark:bg-zinc-100 rounded-full flex items-center justify-center shadow-lg transform transition-transform active:scale-95">
            {isPlaying ? <Pause size={14} className="text-white dark:text-zinc-900" fill="currentColor" /> : <Play size={14} className="text-white dark:text-zinc-900 ml-0.5" fill="currentColor" />}
          </div>
        </div>
        
        {/* Status Indicator */}
        <div className={`absolute top-2 left-2 w-1.5 h-1.5 rounded-full ${isPlaying ? 'animate-google-colors' : 'bg-zinc-200 dark:bg-zinc-600'}`}></div>

        {/* Custom Badge */}
        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 bg-indigo-500/90 text-white text-[8px] font-bold uppercase tracking-wider rounded-full">
          Custom
        </div>
      </div>

      {/* Content Area - Right Side */}
      <div className="flex-1 p-4 flex flex-col justify-center min-w-0 bg-white dark:bg-zinc-800">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-medium text-zinc-900 dark:text-white tracking-tight truncate">{preset.name}</h3>
          <div className="flex gap-1 shrink-0 ml-2">
            <span className="inline-flex items-center px-2 py-0.5 border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 rounded-full">
              {preset.voice_name}
            </span>
            {baseVoice && (
              <span className="inline-flex items-center px-2 py-0.5 border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-medium text-zinc-500 dark:text-zinc-400 rounded-full">
                {baseVoice.analysis.pitch}
              </span>
            )}
          </div>
        </div>
        
        {/* Description / Source Query */}
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-1 font-light">
          {preset.source_query ? `"${preset.source_query}"` : baseVoice ? baseVoice.analysis.characteristics.join(', ') : preset.voice_name}
        </p>

        {!preset.audio_path && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">No cached audio</p>
        )}
      </div>

      {/* Action Buttons - Right Edge (visible on hover) */}
      <div className="hidden sm:flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0" onClick={(e) => e.stopPropagation()}>
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

      {/* Mobile Action Buttons */}
      <div className="flex sm:hidden items-center gap-1.5 px-4 pb-3" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={() => onEdit(preset)}
          className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
          title="Edit preset"
        >
          <Pencil size={12} />
        </button>
        <button
          onClick={() => onDelete(preset)}
          className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 transition-colors border border-zinc-200 dark:border-zinc-700"
          title="Delete preset"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </div>
  );
};

export default PresetCard;
