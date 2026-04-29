/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * VoiceCompare.tsx — A/B Voice Comparison Component
 *
 * Lets users generate TTS for the same text with 2–3 voices side-by-side.
 * Each column shows the voice name, a play/stop button, and a simple waveform
 * visualisation via AudioVisualizer.
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Voice } from '../types';
import { generateTts } from '../api';
import { Play, Square, Loader2, Plus, X, ChevronDown } from 'lucide-react';
import AudioVisualizer from './AudioVisualizer';

interface VoiceCompareProps {
  text: string;
  voices: Voice[];
  systemInstruction?: string;
}

interface CompareSlot {
  voiceName: string;
  audioData: string | null;
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
}

/** Decode base64 PCM to AudioBuffer at 24kHz. */
async function decodePcm(base64: string, ctx: AudioContext): Promise<AudioBuffer> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const buffer = ctx.createBuffer(1, int16.length, 24000);
  const ch = buffer.getChannelData(0);
  for (let i = 0; i < int16.length; i++) ch[i] = int16[i] / 32768.0;
  return buffer;
}

const MAX_SLOTS = 3;

/** Render the side-by-side voice comparison tray. */
const VoiceCompare: React.FC<VoiceCompareProps> = ({ text, voices, systemInstruction }) => {
  const [slots, setSlots] = useState<CompareSlot[]>([
    { voiceName: voices[0]?.name || '', audioData: null, isLoading: false, isPlaying: false, error: null },
    { voiceName: voices[1]?.name || voices[0]?.name || '', audioData: null, isLoading: false, isPlaying: false, error: null },
  ]);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceRefs = useRef<(AudioBufferSourceNode | null)[]>([null, null, null]);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      sourceRefs.current.forEach((s) => { try { s?.stop(); } catch {} });
      if (audioCtxRef.current?.state !== 'closed') audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Reset audio when text changes
  useEffect(() => {
    stopAll();
    setSlots(prev => prev.map(s => ({ ...s, audioData: null, error: null })));
  }, [text]);

  const getAudioCtx = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    return audioCtxRef.current;
  };

  const stopAll = useCallback(() => {
    sourceRefs.current.forEach((s, i) => {
      try { s?.stop(); } catch {}
      sourceRefs.current[i] = null;
    });
    if (isMountedRef.current) setSlots(prev => prev.map(s => ({ ...s, isPlaying: false })));
  }, []);

  const updateSlot = (idx: number, patch: Partial<CompareSlot>) => {
    setSlots(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s));
  };

  const handleGenerate = async (idx: number) => {
    const slot = slots[idx];
    if (!text.trim() || !slot.voiceName || slot.isLoading) return;

    // Stop this slot if playing
    try { sourceRefs.current[idx]?.stop(); } catch {}
    sourceRefs.current[idx] = null;

    updateSlot(idx, { isLoading: true, isPlaying: false, error: null });

    try {
      let audio = slot.audioData;
      if (!audio) {
        audio = await generateTts(text, slot.voiceName, systemInstruction);
        if (!isMountedRef.current) return;
        updateSlot(idx, { audioData: audio });
      }

      const ctx = getAudioCtx();
      if (ctx.state === 'suspended') await ctx.resume();
      const buffer = await decodePcm(audio!, ctx);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      sourceRefs.current[idx] = source;
      source.onended = () => {
        sourceRefs.current[idx] = null;
        if (isMountedRef.current) updateSlot(idx, { isPlaying: false });
      };
      source.start();
      if (isMountedRef.current) updateSlot(idx, { isLoading: false, isPlaying: true });
    } catch (err: any) {
      console.error('Compare TTS error:', err);
      if (isMountedRef.current) updateSlot(idx, { isLoading: false, error: 'Generation failed' });
    }
  };

  const handleStop = (idx: number) => {
    try { sourceRefs.current[idx]?.stop(); } catch {}
    sourceRefs.current[idx] = null;
    updateSlot(idx, { isPlaying: false });
  };

  const handleVoiceChange = (idx: number, voiceName: string) => {
    handleStop(idx);
    updateSlot(idx, { voiceName, audioData: null, error: null });
  };

  const addSlot = () => {
    if (slots.length >= MAX_SLOTS) return;
    const usedNames = new Set(slots.map(s => s.voiceName));
    const next = voices.find(v => !usedNames.has(v.name))?.name || voices[0]?.name || '';
    setSlots(prev => [...prev, { voiceName: next, audioData: null, isLoading: false, isPlaying: false, error: null }]);
  };

  const removeSlot = (idx: number) => {
    if (slots.length <= 2) return;
    handleStop(idx);
    setSlots(prev => prev.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${slots.length}, 1fr)` }}>
        {slots.map((slot, idx) => (
          <div key={idx} className="relative bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl p-3 space-y-2">
            {/* Remove button */}
            {slots.length > 2 && (
              <button
                onClick={() => removeSlot(idx)}
                className="absolute top-2 right-2 p-0.5 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              >
                <X size={12} />
              </button>
            )}

            {/* Voice selector */}
            <div className="relative">
              <select
                value={slot.voiceName}
                onChange={(e) => handleVoiceChange(idx, e.target.value)}
                className="w-full appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 py-1.5 pl-2.5 pr-7 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                disabled={slot.isLoading}
              >
                {voices.map(v => (
                  <option key={v.name} value={v.name}>{v.name}</option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-zinc-400">
                <ChevronDown size={12} />
              </div>
            </div>

            {/* Play/Stop + Visualizer */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => slot.isPlaying ? handleStop(idx) : handleGenerate(idx)}
                disabled={slot.isLoading || !text.trim()}
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  slot.isPlaying
                    ? 'bg-red-500 hover:bg-red-600 text-white'
                    : 'bg-indigo-500 hover:bg-indigo-600 text-white disabled:opacity-40'
                }`}
              >
                {slot.isLoading ? <Loader2 size={14} className="animate-spin" /> : slot.isPlaying ? <Square size={12} /> : <Play size={14} className="ml-0.5" />}
              </button>
              <div className="flex-1 h-8 overflow-hidden rounded-lg">
                <AudioVisualizer isPlaying={slot.isPlaying} />
              </div>
            </div>

            {/* Error */}
            {slot.error && <p className="text-[10px] text-red-500">{slot.error}</p>}
          </div>
        ))}
      </div>

      {/* Add voice slot */}
      {slots.length < MAX_SLOTS && (
        <button
          onClick={addSlot}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
        >
          <Plus size={12} />
          Add voice to compare
        </button>
      )}
    </div>
  );
};

export default VoiceCompare;
