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

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Voice, CustomPreset } from '../types';
import { X, FileText, Mic, User, ChevronDown, Users, Play, Square, Loader2, Download } from 'lucide-react';
import { VOICE_DATA } from '../constants';
import { generateMultiSpeakerTts } from '../api';
import AiTtsPreview from './AiTtsPreview';
import AudioTagsToolbar from './AudioTagsToolbar';

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
  const [mode, setMode] = useState<'single' | 'dialogue'>('single');
  const [speaker1Name, setSpeaker1Name] = useState('Speaker1');
  const [speaker2Name, setSpeaker2Name] = useState('Speaker2');
  const [speaker1Voice, setSpeaker1Voice] = useState(voices[0]?.name || '');
  const [speaker2Voice, setSpeaker2Voice] = useState(voices[1]?.name || voices[0]?.name || '');
  const [dialogueLoading, setDialogueLoading] = useState(false);
  const [dialoguePlaying, setDialoguePlaying] = useState(false);
  const [dialogueError, setDialogueError] = useState<string | null>(null);
  const [dialogueAudio, setDialogueAudio] = useState<string | null>(null);
  const dialogueAudioCtxRef = useRef<AudioContext | null>(null);
  const dialogueSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isMountedRef = useRef(true);
  const modalRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleInsertTag = (tag: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText = script.substring(0, start) + tag + ' ' + script.substring(end);
    setScript(newText);
    requestAnimationFrame(() => {
      textarea.selectionStart = textarea.selectionEnd = start + tag.length + 1;
      textarea.focus();
    });
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopDialogueAudio();
      if (dialogueAudioCtxRef.current && dialogueAudioCtxRef.current.state !== 'closed') {
        dialogueAudioCtxRef.current.close().catch(console.error);
      }
    };
  }, []);

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

  // Reset dialogue audio when script or voices change
  useEffect(() => {
    setDialogueAudio(null);
    stopDialogueAudio();
  }, [script, speaker1Voice, speaker2Voice, speaker1Name, speaker2Name]);

  const stopDialogueAudio = useCallback(() => {
    if (dialogueSourceRef.current) {
      try { dialogueSourceRef.current.stop(); } catch (e) {}
      dialogueSourceRef.current = null;
    }
    if (isMountedRef.current) setDialoguePlaying(false);
  }, []);

  const handleDialoguePlay = async () => {
    if (dialogueLoading || !script.trim()) return;
    if (dialoguePlaying) { stopDialogueAudio(); return; }

    setDialogueLoading(true);
    setDialogueError(null);

    try {
      let audioData = dialogueAudio;
      if (!audioData) {
        audioData = await generateMultiSpeakerTts(script, [
          { speaker: speaker1Name, voiceName: speaker1Voice },
          { speaker: speaker2Name, voiceName: speaker2Voice },
        ]);
        if (!isMountedRef.current) return;
        setDialogueAudio(audioData);
      }

      if (!dialogueAudioCtxRef.current || dialogueAudioCtxRef.current.state === 'closed') {
        dialogueAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (dialogueAudioCtxRef.current.state === 'suspended') {
        await dialogueAudioCtxRef.current.resume();
      }

      const binaryString = atob(audioData);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);

      const dataInt16 = new Int16Array(bytes.buffer);
      const frameCount = dataInt16.length;
      const buffer = dialogueAudioCtxRef.current.createBuffer(1, frameCount, 24000);
      const channelData = buffer.getChannelData(0);
      for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i] / 32768.0;

      const source = dialogueAudioCtxRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(dialogueAudioCtxRef.current.destination);
      source.onended = () => { if (isMountedRef.current) setDialoguePlaying(false); };
      dialogueSourceRef.current = source;
      source.start();
      setDialoguePlaying(true);
    } catch (err: any) {
      console.error('Dialogue TTS Error:', err);
      if (isMountedRef.current) setDialogueError('Failed to generate dialogue. Please try again.');
    } finally {
      if (isMountedRef.current) setDialogueLoading(false);
    }
  };

  const handleDialogueDownload = async () => {
    if (dialogueLoading || !script.trim()) return;
    setDialogueLoading(true);
    setDialogueError(null);

    try {
      let audioData = dialogueAudio;
      if (!audioData) {
        audioData = await generateMultiSpeakerTts(script, [
          { speaker: speaker1Name, voiceName: speaker1Voice },
          { speaker: speaker2Name, voiceName: speaker2Voice },
        ]);
        if (!isMountedRef.current) return;
        setDialogueAudio(audioData);
      }

      const binaryString = atob(audioData);
      const pcmData = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) pcmData[i] = binaryString.charCodeAt(i);

      const wavBuffer = new ArrayBuffer(44 + pcmData.length);
      const view = new DataView(wavBuffer);
      const writeStr = (o: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
      writeStr(0, 'RIFF'); view.setUint32(4, 36 + pcmData.length, true); writeStr(8, 'WAVE');
      writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
      view.setUint16(22, 1, true); view.setUint32(24, 24000, true); view.setUint32(28, 48000, true);
      view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      writeStr(36, 'data'); view.setUint32(40, pcmData.length, true);
      new Uint8Array(wavBuffer, 44).set(pcmData);

      const blob = new Blob([wavBuffer], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `dialogue-${Date.now()}.wav`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download Error:', err);
      if (isMountedRef.current) setDialogueError('Failed to download audio.');
    } finally {
      if (isMountedRef.current) setDialogueLoading(false);
    }
  };

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

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Mode Toggle */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 w-fit">
            <button
              onClick={() => setMode('single')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'single' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
            >
              <Mic size={12} />
              Single Speaker
            </button>
            <button
              onClick={() => setMode('dialogue')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === 'dialogue' ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm' : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}
            >
              <Users size={12} />
              Dialogue (2 Speakers)
            </button>
          </div>

          {/* Dialogue Speaker Config — shown only in dialogue mode */}
          {mode === 'dialogue' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Speaker 1</label>
                <input
                  type="text"
                  value={speaker1Name}
                  onChange={(e) => setSpeaker1Name(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Speaker name"
                />
                <div className="relative">
                  <select
                    value={speaker1Voice}
                    onChange={(e) => setSpeaker1Voice(e.target.value)}
                    className="appearance-none w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-1.5 pl-3 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.analysis.gender})</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400"><ChevronDown size={12} /></div>
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">Speaker 2</label>
                <input
                  type="text"
                  value={speaker2Name}
                  onChange={(e) => setSpeaker2Name(e.target.value)}
                  className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                  placeholder="Speaker name"
                />
                <div className="relative">
                  <select
                    value={speaker2Voice}
                    onChange={(e) => setSpeaker2Voice(e.target.value)}
                    className="appearance-none w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-1.5 pl-3 pr-8 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                  >
                    {voices.map(v => <option key={v.name} value={v.name}>{v.name} ({v.analysis.gender})</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-zinc-400"><ChevronDown size={12} /></div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="script-input" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {mode === 'dialogue' ? `Enter dialogue (prefix lines with "${speaker1Name}:" or "${speaker2Name}:")` : 'Enter your script'}
            </label>
            <AudioTagsToolbar onInsertTag={handleInsertTag} />
            <textarea
              id="script-input"
              ref={textareaRef}
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

              {/* Stock / Custom Voice Toggle — single speaker only */}
              {mode === 'single' && customPresets.length > 0 && (
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

            {/* Custom preset selector — shown only when in custom mode (single speaker) */}
            {mode === 'single' && voiceSource === 'custom' && customPresets.length > 0 && (
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
            
            {/* Single speaker preview */}
            {mode === 'single' && (
              voiceSource === 'stock' ? (
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
              )
            )}

            {/* Dialogue preview */}
            {mode === 'dialogue' && (
              <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-100 dark:border-zinc-700 overflow-hidden">
                <div className="p-4 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-700">
                  <span className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                    {speaker1Voice} + {speaker2Voice}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleDialogueDownload}
                      disabled={dialogueLoading || !script.trim()}
                      className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Download Dialogue WAV"
                    >
                      {dialogueLoading && !dialoguePlaying ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    </button>
                    <button
                      onClick={handleDialoguePlay}
                      disabled={dialogueLoading || !script.trim()}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                        dialoguePlaying
                          ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-600'
                          : 'bg-zinc-900 dark:bg-indigo-600 text-white hover:bg-zinc-800 dark:hover:bg-indigo-500 shadow-md'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {dialogueLoading ? <Loader2 size={14} className="animate-spin" /> : dialoguePlaying ? <Square size={14} className="fill-current" /> : <Play size={14} className="fill-current" />}
                      <span>{dialogueLoading ? 'Generating...' : dialoguePlaying ? 'Stop' : 'Listen'}</span>
                    </button>
                  </div>
                </div>
                {dialogueError && (
                  <div className="px-4 py-2 text-xs text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
                    {dialogueError}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScriptReaderModal;
