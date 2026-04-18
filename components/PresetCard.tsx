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
import { Play, Pause, Activity, Loader2, Pencil, Trash2, Copy, Check, X as XIcon } from 'lucide-react';
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
  onDuplicate?: (preset: CustomPreset) => void;
  onInlineEdit?: (id: number, data: { name?: string; system_instruction?: string }) => Promise<void>;
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

const PresetCard: React.FC<PresetCardProps> = ({ preset, isPlaying, onPlayToggle, onEdit, onDelete, onDuplicate, onInlineEdit }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const [isInlineEditing, setIsInlineEditing] = useState(false);
  const [editName, setEditName] = useState(preset.name);
  const [editInstruction, setEditInstruction] = useState(preset.system_instruction || '');
  const [isSavingInline, setIsSavingInline] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isMountedRef = useRef(true);
  const nameInputRef = useRef<HTMLInputElement>(null);

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
    if (isInlineEditing) return;
    if (preset.audio_path && !isLoading) {
      handlePlay();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isInlineEditing) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const startInlineEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onInlineEdit) {
      setEditName(preset.name);
      setEditInstruction(preset.system_instruction || '');
      setIsInlineEditing(true);
      setTimeout(() => nameInputRef.current?.focus(), 50);
    } else {
      onEdit(preset);
    }
  };

  const cancelInlineEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsInlineEditing(false);
  };

  const saveInlineEdit = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onInlineEdit) return;
    const trimmed = editName.trim();
    if (!trimmed) return;
    setIsSavingInline(true);
    try {
      await onInlineEdit(preset.id, {
        name: trimmed !== preset.name ? trimmed : undefined,
        system_instruction: editInstruction !== (preset.system_instruction || '') ? editInstruction : undefined,
      });
      setIsInlineEditing(false);
    } catch (err) {
      console.error('Inline edit failed:', err);
    } finally {
      if (isMountedRef.current) setIsSavingInline(false);
    }
  };

  return (
    <div 
      className={`group relative bg-white dark:bg-zinc-800 border transition-all duration-200 flex flex-col sm:flex-row h-auto sm:h-28 cursor-pointer rounded-2xl overflow-hidden hover:border-zinc-300 dark:hover:border-zinc-600 ${isPlaying ? 'border-blue-200 dark:border-blue-800 ring-2 ring-blue-100 dark:ring-blue-900/30 shadow-md' : 'border-zinc-200 dark:border-zinc-700 shadow-sm hover:shadow-md'}`}
      style={{ borderLeftWidth: '4px', borderLeftColor: preset.color || '#6366f1' }}
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
          ) : preset.audio_path ? (
            /* Mini static waveform when audio is cached */
            <div className="flex items-center gap-[2px] h-8">
              {Array.from({ length: 12 }, (_, i) => {
                // Deterministic heights from preset ID
                const seed = ((preset.id * 7 + i * 13 + 37) % 100) / 100;
                const h = 20 + seed * 80; // 20-100% height
                return (
                  <div
                    key={i}
                    className="w-[2px] rounded-full bg-zinc-300 dark:bg-zinc-600"
                    style={{ height: `${h}%` }}
                  />
                );
              })}
            </div>
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
      <div
        className="flex-1 p-4 flex flex-col justify-center min-w-0 bg-white dark:bg-zinc-800 relative"
        onMouseEnter={() => !isInlineEditing && preset.system_instruction && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        
        {/* System Instruction Tooltip */}
        {showTooltip && !isInlineEditing && preset.system_instruction && (
          <div className="absolute bottom-full left-4 right-4 mb-2 z-50 pointer-events-none animate-fade-in">
            <div className="bg-zinc-900 dark:bg-zinc-700 text-white text-xs rounded-xl p-3 shadow-lg max-h-32 overflow-y-auto">
              <p className="font-medium text-zinc-300 dark:text-zinc-400 mb-1 text-[10px] uppercase tracking-wider">System Instruction</p>
              <p className="leading-relaxed whitespace-pre-wrap">{preset.system_instruction}</p>
            </div>
          </div>
        )}

        {isInlineEditing ? (
          /* Inline Edit Mode */
          <div className="space-y-2" onClick={e => e.stopPropagation()}>
            <input
              ref={nameInputRef}
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800"
              maxLength={100}
              placeholder="Preset name"
              onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setIsInlineEditing(false); } }}
            />
            <textarea
              value={editInstruction}
              onChange={e => setEditInstruction(e.target.value)}
              rows={2}
              className="w-full px-2 py-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-200 dark:focus:ring-indigo-800 resize-none"
              placeholder="System instruction (optional)"
              onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); setIsInlineEditing(false); } }}
            />
            <div className="flex items-center gap-1.5">
              <button
                onClick={saveInlineEdit}
                disabled={isSavingInline || !editName.trim()}
                className="flex items-center gap-1 px-2.5 py-1 bg-zinc-900 dark:bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-zinc-800 dark:hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                {isSavingInline ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                Save
              </button>
              <button
                onClick={cancelInlineEdit}
                className="px-2.5 py-1 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          /* Display Mode */
          <>
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

            {/* Tags */}
            {preset.tags && preset.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {preset.tags.map(t => (
                  <span
                    key={t.tag}
                    className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-semibold rounded-full text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.tag}
                  </span>
                ))}
              </div>
            )}

            {!preset.audio_path && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">No cached audio</p>
            )}
          </>
        )}
      </div>

      {/* Action Buttons - Right Edge (visible on hover) */}
      {!isInlineEditing && (
      <div className="hidden sm:flex items-center gap-1 pr-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200 shrink-0" onClick={(e) => e.stopPropagation()}>
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
          onClick={startInlineEdit}
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

      {/* Mobile Action Buttons */}
      {!isInlineEditing && (
      <div className="flex sm:hidden items-center gap-1.5 px-4 pb-3" onClick={(e) => e.stopPropagation()}>
        {onDuplicate && (
          <button
            onClick={() => onDuplicate(preset)}
            className="p-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-200 dark:border-zinc-700"
            title="Duplicate preset"
          >
            <Copy size={12} />
          </button>
        )}
        <button
          onClick={startInlineEdit}
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
      )}
    </div>
  );
};

export default PresetCard;
