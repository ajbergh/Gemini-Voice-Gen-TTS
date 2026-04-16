/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * ScriptReaderModal.tsx — Custom Script Testing Modal
 *
 * Modal dialog for testing TTS with custom text. Users can type or paste a
 * script and preview it with any available voice using the embedded AiTtsPreview
 * component. Supports both stock voices and custom presets via a tab toggle.
 * Implements focus trap and Escape-to-close for accessibility.
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Voice, CustomPreset } from '../types';
import { X, FileText, Mic, User, ChevronDown } from 'lucide-react';
import { VOICE_DATA } from '../constants';
import AiTtsPreview from './AiTtsPreview';

interface ScriptReaderModalProps {
  voices: Voice[];
  customPresets?: CustomPreset[];
  initialVoiceName?: string;
  onClose: () => void;
}

const ScriptReaderModal: React.FC<ScriptReaderModalProps> = ({ voices, customPresets = [], initialVoiceName, onClose }) => {
  const [script, setScript] = useState('Hello! I am ready to read your script. Type something here and click Listen.');
  const [voiceSource, setVoiceSource] = useState<'stock' | 'custom'>('stock');
  const [selectedPresetId, setSelectedPresetId] = useState<number | null>(customPresets[0]?.id ?? null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    modalRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Re-order voices so the initialVoiceName is first, because AiTtsPreview defaults to voices[0]
  const sortedVoices = useMemo(() => [...voices].sort((a, b) => {
    if (a.name === initialVoiceName) return -1;
    if (b.name === initialVoiceName) return 1;
    return 0;
  }), [voices, initialVoiceName]);

  // Find the selected preset and build a single-voice array for AiTtsPreview
  const selectedPreset = useMemo(() => customPresets.find(p => p.id === selectedPresetId), [customPresets, selectedPresetId]);
  const presetVoiceForTts: Voice[] = useMemo(() => {
    if (!selectedPreset) return [];
    const baseVoice = VOICE_DATA.find(v => v.name === selectedPreset.voice_name);
    if (!baseVoice) return [];
    return [baseVoice];
  }, [selectedPreset]);

  return (
    <div 
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
      aria-labelledby="script-reader-title"
    >
      <div className="absolute inset-0" onClick={onClose}></div>
      <div 
        ref={modalRef}
        tabIndex={-1}
        className="relative w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col outline-none animate-slide-up"
      >
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex items-center gap-2 text-zinc-900 dark:text-white">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              <FileText size={18} />
            </div>
            <h2 id="script-reader-title" className="text-lg font-bold">Test Script</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-2">
            <label htmlFor="script-input" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Enter your script
            </label>
            <textarea
              id="script-input"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              className="w-full h-32 p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
              placeholder="Type the script you want the voice to read..."
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Preview
              </label>

              {/* Stock / Custom Voice Toggle */}
              {customPresets.length > 0 && (
                <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700">
                  <button
                    onClick={() => setVoiceSource('stock')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${voiceSource === 'stock' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                  >
                    <Mic size={11} />
                    Stock
                  </button>
                  <button
                    onClick={() => setVoiceSource('custom')}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${voiceSource === 'custom' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
                  >
                    <User size={11} />
                    My Voices
                    <span className={`text-[10px] font-bold px-1 py-0.5 rounded-full ${voiceSource === 'custom' ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300' : 'bg-zinc-200 dark:bg-zinc-600 text-zinc-600 dark:text-zinc-300'}`}>
                      {customPresets.length}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Custom preset selector — shown only when in custom mode */}
            {voiceSource === 'custom' && customPresets.length > 0 && (
              <div className="relative">
                <select
                  value={selectedPresetId ?? ''}
                  onChange={(e) => setSelectedPresetId(Number(e.target.value))}
                  className="appearance-none w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-2 pl-3 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  {customPresets.map(preset => (
                    <option key={preset.id} value={preset.id}>
                      {preset.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                  <ChevronDown size={14} />
                </div>
              </div>
            )}
            
            {voiceSource === 'stock' ? (
              <div className="bg-white dark:bg-zinc-800 p-1 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                <AiTtsPreview text={script} voices={sortedVoices} />
              </div>
            ) : presetVoiceForTts.length > 0 ? (
              <div className="bg-white dark:bg-zinc-800 p-1 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700">
                <AiTtsPreview key={selectedPresetId} text={script} voices={presetVoiceForTts} hideVoiceSelector systemInstruction={selectedPreset?.system_instruction || undefined} />
              </div>
            ) : (
              <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700 p-6 text-center">
                <p className="text-sm text-zinc-500 dark:text-zinc-400">No custom voice presets yet. Save a preset from the AI Casting Director first.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptReaderModal;
