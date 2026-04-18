/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AiTtsPreview.tsx — TTS Generation, Playback & Download
 *
 * Generates speech from text using a selected Gemini TTS voice via the backend
 * proxy (/api/voices/tts). Audio is returned as base64-encoded raw PCM
 * (24kHz, 16-bit, mono), decoded with Web Audio API for playback, and can be
 * downloaded as a proper WAV file with RIFF headers. Supports streaming TTS,
 * model selection (3.1 Flash / 2.5 Flash), playback speed control, language
 * auto-detection, undo/redo for settings, and an AudioVisualizer canvas.
 * Includes voice selector dropdown with optional display name overrides.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Square, Loader2, Volume2, AlertCircle, ChevronDown, Download, Save, Globe, Zap, Undo2, Redo2 } from 'lucide-react';

/** Snapshot of TTS settings for undo/redo. */
interface TtsSettingsSnapshot {
  voiceName: string;
  languageCode: string;
  ttsModel: string;
  playbackSpeed: number;
  useStreaming: boolean;
}
import { generateTts, streamTts } from '../api';
import { Voice } from '../types';
import AudioVisualizer from './AudioVisualizer';

/** Supported languages for Gemini 3.1 Flash TTS. */
const TTS_LANGUAGES: { code: string; label: string }[] = [
  { code: '', label: 'Auto-detect' },
  { code: 'ar-XA', label: 'Arabic' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'zh-CN', label: 'Chinese (Mandarin)' },
  { code: 'cs-CZ', label: 'Czech' },
  { code: 'da-DK', label: 'Danish' },
  { code: 'nl-NL', label: 'Dutch' },
  { code: 'en-US', label: 'English' },
  { code: 'fi-FI', label: 'Finnish' },
  { code: 'fr-FR', label: 'French' },
  { code: 'de-DE', label: 'German' },
  { code: 'el-GR', label: 'Greek' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'hu-HU', label: 'Hungarian' },
  { code: 'id-ID', label: 'Indonesian' },
  { code: 'it-IT', label: 'Italian' },
  { code: 'ja-JP', label: 'Japanese' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'ko-KR', label: 'Korean' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'nb-NO', label: 'Norwegian' },
  { code: 'pl-PL', label: 'Polish' },
  { code: 'pt-BR', label: 'Portuguese (BR)' },
  { code: 'ro-RO', label: 'Romanian' },
  { code: 'ru-RU', label: 'Russian' },
  { code: 'sk-SK', label: 'Slovak' },
  { code: 'es-ES', label: 'Spanish' },
  { code: 'sv-SE', label: 'Swedish' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'th-TH', label: 'Thai' },
  { code: 'tr-TR', label: 'Turkish' },
  { code: 'uk-UA', label: 'Ukrainian' },
  { code: 'vi-VN', label: 'Vietnamese' },
];

interface AiTtsPreviewProps {
  text: string;
  voices: Voice[];
  systemInstruction?: string;
  sourceQuery?: string;
  hideVoiceSelector?: boolean;
  voiceDisplayNames?: Record<string, string>;
  /** Optional accent dropdown options rendered next to the voice selector. */
  accentOptions?: { id: string; label: string }[];
  selectedAccentId?: string;
  onAccentChange?: (id: string) => void;
  /** When set, overrides the language selector (e.g. force en-US for accent mode). */
  forceLanguageCode?: string;
  onVoiceChange?: (voiceName: string) => void;
  onSavePreset?: (data: { voiceName: string; text: string; systemInstruction: string; audioBase64: string | null; sourceQuery: string }) => void;
}

/** Decode a base64 string into a raw Uint8Array of bytes. */
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode raw PCM bytes (16-bit signed, little-endian) into a Web Audio API
 * AudioBuffer at the specified sample rate.
 */
async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

/**
 * Build a WAV file (RIFF header + raw PCM data) from PCM bytes.
 * Returns a downloadable Blob with audio/wav MIME type.
 */
function createWavFile(pcmData: Uint8Array, sampleRate: number = 24000, numChannels: number = 1): Blob {
  const buffer = new ArrayBuffer(44 + pcmData.length);
  const view = new DataView(buffer);

  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, pcmData.length, true);

  const pcmBytes = new Uint8Array(buffer, 44);
  pcmBytes.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Lightweight client-side language detection based on Unicode script ranges.
 * Returns a matching TTS languageCode or '' if unknown/ambiguous.
 */
function detectLanguageCode(input: string): string {
  // Strip tags, whitespace-only content, and limit sample
  const sample = input.replace(/\[.*?\]/g, '').replace(/^##\s+.*$/gm, '').trim().slice(0, 300);
  if (sample.length < 10) return '';

  const counts: Record<string, number> = {};
  for (const ch of sample) {
    const cp = ch.codePointAt(0)!;
    // Skip ASCII punctuation, digits, whitespace
    if (cp <= 0x7f) { counts['latin'] = (counts['latin'] || 0) + (cp >= 0x41 && cp <= 0x7a ? 1 : 0); continue; }
    if (cp >= 0x0600 && cp <= 0x06ff) { counts['ar-XA'] = (counts['ar-XA'] || 0) + 1; continue; }
    if (cp >= 0x0980 && cp <= 0x09ff) { counts['bn-IN'] = (counts['bn-IN'] || 0) + 1; continue; }
    if (cp >= 0x4e00 && cp <= 0x9fff) { counts['zh-CN'] = (counts['zh-CN'] || 0) + 1; continue; }
    if (cp >= 0x0900 && cp <= 0x097f) { counts['hi-IN'] = (counts['hi-IN'] || 0) + 1; continue; }
    if (cp >= 0x0a80 && cp <= 0x0aff) { counts['gu-IN'] = (counts['gu-IN'] || 0) + 1; continue; }
    if (cp >= 0x0c80 && cp <= 0x0cff) { counts['kn-IN'] = (counts['kn-IN'] || 0) + 1; continue; }
    if (cp >= 0x0d00 && cp <= 0x0d7f) { counts['ml-IN'] = (counts['ml-IN'] || 0) + 1; continue; }
    if (cp >= 0x0900 && cp <= 0x097f) { counts['mr-IN'] = (counts['mr-IN'] || 0) + 1; continue; }
    if (cp >= 0x0b80 && cp <= 0x0bff) { counts['ta-IN'] = (counts['ta-IN'] || 0) + 1; continue; }
    if (cp >= 0x0c00 && cp <= 0x0c7f) { counts['te-IN'] = (counts['te-IN'] || 0) + 1; continue; }
    if (cp >= 0x0e00 && cp <= 0x0e7f) { counts['th-TH'] = (counts['th-TH'] || 0) + 1; continue; }
    if (cp >= 0x3040 && cp <= 0x309f) { counts['ja-JP'] = (counts['ja-JP'] || 0) + 1; continue; }
    if (cp >= 0x30a0 && cp <= 0x30ff) { counts['ja-JP'] = (counts['ja-JP'] || 0) + 1; continue; }
    if (cp >= 0xac00 && cp <= 0xd7af) { counts['ko-KR'] = (counts['ko-KR'] || 0) + 1; continue; }
    if (cp >= 0x0400 && cp <= 0x04ff) { counts['cyrillic'] = (counts['cyrillic'] || 0) + 1; continue; }
    if (cp >= 0x0370 && cp <= 0x03ff) { counts['el-GR'] = (counts['el-GR'] || 0) + 1; continue; }
    if (cp >= 0x00c0 && cp <= 0x024f) { counts['latin-ext'] = (counts['latin-ext'] || 0) + 1; continue; }
  }

  // Pick the dominant non-latin script
  let best = '';
  let bestCount = 0;
  for (const [key, count] of Object.entries(counts)) {
    if (key === 'latin' || key === 'latin-ext') continue;
    if (count > bestCount) { best = key; bestCount = count; }
  }

  // For non-Latin scripts that map directly
  if (best && best !== 'cyrillic') return best;

  // Cyrillic: default to Russian (could be Ukrainian but Russian is more common)
  if (best === 'cyrillic') {
    // Check for Ukrainian-specific chars: і, ї, є, ґ
    if (/[іїєґІЇЄҐ]/.test(sample)) return 'uk-UA';
    return 'ru-RU';
  }

  // Latin script — leave as '' (auto-detect) since we can't reliably distinguish
  // among English, French, German, Spanish, etc. from script alone.
  return '';
}

const AiTtsPreview: React.FC<AiTtsPreviewProps> = ({ text, voices, systemInstruction, sourceQuery, hideVoiceSelector, voiceDisplayNames, accentOptions, selectedAccentId, onAccentChange, forceLanguageCode, onVoiceChange, onSavePreset }) => {
  const [selectedVoiceName, setSelectedVoiceName] = useState(voices[0]?.name || '');
  const [languageCode, setLanguageCode] = useState('');
  const [autoDetectedLang, setAutoDetectedLang] = useState('');
  const userOverrodeLangRef = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [ttsModel, setTtsModel] = useState('gemini-3.1-flash-tts-preview');
  const [useStreaming, setUseStreaming] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  
  // Undo/redo stack for TTS settings
  const MAX_UNDO = 50;
  const undoStackRef = useRef<TtsSettingsSnapshot[]>([]);
  const redoStackRef = useRef<TtsSettingsSnapshot[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const isRestoringRef = useRef(false);

  const getCurrentSnapshot = useCallback((): TtsSettingsSnapshot => ({
    voiceName: selectedVoiceName,
    languageCode,
    ttsModel,
    playbackSpeed,
    useStreaming,
  }), [selectedVoiceName, languageCode, ttsModel, playbackSpeed, useStreaming]);

  const pushUndo = useCallback((snapshot: TtsSettingsSnapshot) => {
    if (isRestoringRef.current) return;
    undoStackRef.current.push(snapshot);
    if (undoStackRef.current.length > MAX_UNDO) undoStackRef.current.shift();
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  }, []);

  const applySnapshot = useCallback((snap: TtsSettingsSnapshot) => {
    isRestoringRef.current = true;
    setSelectedVoiceName(snap.voiceName);
    setLanguageCode(snap.languageCode);
    setTtsModel(snap.ttsModel);
    setPlaybackSpeed(snap.playbackSpeed);
    setUseStreaming(snap.useStreaming);
    // Reset restoring flag after React processes state updates
    requestAnimationFrame(() => { isRestoringRef.current = false; });
  }, []);

  const handleUndo = useCallback(() => {
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop()!;
    redoStackRef.current.push(getCurrentSnapshot());
    applySnapshot(prev);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
  }, [getCurrentSnapshot, applySnapshot]);

  const handleRedo = useCallback(() => {
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop()!;
    undoStackRef.current.push(getCurrentSnapshot());
    applySnapshot(next);
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
  }, [getCurrentSnapshot, applySnapshot]);

  // Keyboard shortcuts: Ctrl+Z / Ctrl+Shift+Z
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        if (undoStackRef.current.length > 0) { e.preventDefault(); handleUndo(); }
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        if (redoStackRef.current.length > 0) { e.preventDefault(); handleRedo(); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopAudio();
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
    if (voices.length > 0 && !voices.find(v => v.name === selectedVoiceName)) {
        setSelectedVoiceName(voices[0].name);
    }
  }, [voices, selectedVoiceName]);

  // Auto-detect language from non-Latin scripts and pre-select languageCode
  useEffect(() => {
    const detected = detectLanguageCode(text);
    setAutoDetectedLang(detected);
    // Only auto-set if user hasn't manually overridden
    if (!userOverrodeLangRef.current) {
      setLanguageCode(detected);
    }
  }, [text]);

  useEffect(() => {
    setAudioData(null);
    stopAudio();
  }, [text, selectedVoiceName, languageCode, systemInstruction]);

  // When forceLanguageCode is set (e.g. accent mode forces en-US), use it; otherwise use user selection.
  const effectiveLanguageCode = forceLanguageCode !== undefined ? forceLanguageCode : languageCode;

  /** Stop any currently playing audio source and reset playback state. */
  const stopAudio = () => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch (e) {}
      sourceNodeRef.current = null;
    }
    if (isMountedRef.current) {
      setIsPlaying(false);
    }
  };

  /** Generate TTS audio via the backend and cache the base64 result. */
  const generateAudio = async (): Promise<string | null> => {
    setError(null);
    try {
      const audioDataBase64 = await generateTts(text, selectedVoiceName, systemInstruction, effectiveLanguageCode || undefined, ttsModel);
      
      if (!isMountedRef.current) return null;

      setAudioData(audioDataBase64);
      return audioDataBase64;
    } catch (err: any) {
      console.error("TTS Error:", err);
      if (isMountedRef.current) {
        const msg = err?.message || '';
        if (msg.includes('503') || msg.includes('unavailable')) {
          setError("Gemini TTS model is temporarily overloaded. Please try again in a few seconds.");
        } else {
          setError(msg || "Failed to generate speech. Please try again.");
        }
      }
      return null;
    }
  };

  /** Play/pause toggle: generates audio if not cached, then plays via Web Audio API. */
  const handlePlay = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isLoading || isDownloading || !text.trim()) return;

    if (isPlaying || isStreaming) {
      stopAudio();
      streamAbortRef.current?.abort();
      streamAbortRef.current = null;
      if (isMountedRef.current) { setIsStreaming(false); setIsPlaying(false); }
      return;
    }

    // Use streaming path if enabled and no cached audio
    if (useStreaming && !audioData) {
      handleStreamPlay();
      return;
    }
    
    setIsLoading(true);
    
    let currentAudioData = audioData;
    if (!currentAudioData) {
      currentAudioData = await generateAudio();
    }

    if (!currentAudioData) {
      if (isMountedRef.current) setIsLoading(false);
      return;
    }

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const rawBytes = decodeBase64(currentAudioData);
      const audioBuffer = await decodeAudioData(rawBytes, audioContextRef.current, 24000);
      
      if (!isMountedRef.current) return;

      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackSpeed;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        if (isMountedRef.current) setIsPlaying(false);
      };
      
      sourceNodeRef.current = source;
      source.start();
      setIsPlaying(true);
    } catch (err: any) {
      console.error("Playback Error:", err);
      if (isMountedRef.current) setError("Failed to play audio.");
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  };

  /** Stream TTS audio chunks and play them as they arrive. */
  const handleStreamPlay = async () => {
    setIsLoading(true);
    setIsStreaming(true);
    setError(null);

    const abortCtrl = new AbortController();
    streamAbortRef.current = abortCtrl;

    try {
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      } else if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const ctx = audioContextRef.current;
      const allChunks: string[] = [];
      let nextStartTime = ctx.currentTime + 0.05; // small initial buffer

      await streamTts(text, selectedVoiceName, {
        systemInstruction,
        languageCode: effectiveLanguageCode || undefined,
        model: ttsModel,
        signal: abortCtrl.signal,
        onChunk: (audioBase64, index) => {
          if (!isMountedRef.current) return;
          allChunks.push(audioBase64);

          // Play this chunk immediately
          try {
            const rawBytes = decodeBase64(audioBase64);
            const int16 = new Int16Array(rawBytes.buffer);
            const frameCount = int16.length;
            const buffer = ctx.createBuffer(1, frameCount, 24000);
            const channelData = buffer.getChannelData(0);
            for (let i = 0; i < frameCount; i++) channelData[i] = int16[i] / 32768.0;

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = playbackSpeed;
            source.connect(ctx.destination);
            source.start(nextStartTime);
            nextStartTime += buffer.duration / playbackSpeed;

            if (index === 0) {
              if (isMountedRef.current) { setIsPlaying(true); setIsLoading(false); }
            }
          } catch (err) {
            console.warn('Failed to play chunk', index, err);
          }
        },
        onDone: () => {
          // Combine all chunks into a single audioData for caching/download
          if (allChunks.length > 0 && isMountedRef.current) {
            // Combine base64 chunks: decode, concatenate, re-encode
            const decoded = allChunks.map(c => decodeBase64(c));
            const totalLen = decoded.reduce((sum, d) => sum + d.length, 0);
            const combined = new Uint8Array(totalLen);
            let offset = 0;
            for (const d of decoded) { combined.set(d, offset); offset += d.length; }
            // Re-encode to base64 for caching
            let binaryStr = '';
            for (let i = 0; i < combined.length; i++) binaryStr += String.fromCharCode(combined[i]);
            setAudioData(btoa(binaryStr));
          }
          if (isMountedRef.current) setIsStreaming(false);
          streamAbortRef.current = null;
          // Schedule isPlaying = false after all chunks finish
          const remaining = nextStartTime - ctx.currentTime;
          setTimeout(() => {
            if (isMountedRef.current) setIsPlaying(false);
          }, Math.max(0, remaining * 1000 + 200));
        },
        onError: (err) => {
          if (isMountedRef.current) {
            setError('Streaming TTS failed: ' + err);
            setIsLoading(false);
            setIsStreaming(false);
            setIsPlaying(false);
          }
        },
      });
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.error('Stream error:', err);
        if (isMountedRef.current) { setError('Streaming failed'); setIsLoading(false); setIsStreaming(false); }
      }
    }
  };

  /** Download audio as a WAV file; generates if not cached. */
  const handleDownload = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isLoading || isDownloading || !text.trim()) return;

    setIsDownloading(true);

    let currentAudioData = audioData;
    if (!currentAudioData) {
      currentAudioData = await generateAudio();
    }

    if (!currentAudioData) {
      if (isMountedRef.current) setIsDownloading(false);
      return;
    }

    try {
      const rawBytes = decodeBase64(currentAudioData);
      const blob = createWavFile(rawBytes, 24000);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tts-${selectedVoiceName}-${Date.now()}.wav`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download Error:", err);
      if (isMountedRef.current) setError("Failed to download audio.");
    } finally {
      if (isMountedRef.current) setIsDownloading(false);
    }
  };

  return (
    <div className="w-full bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
        {/* Header / Controls */}
        <div className="p-3 flex flex-wrap gap-2 items-center bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700">
            
            {/* Voice Selector */}
            {!hideVoiceSelector && (
            <div className="relative group">
                <select
                    value={selectedVoiceName}
                    onChange={(e) => { pushUndo(getCurrentSnapshot()); setSelectedVoiceName(e.target.value); onVoiceChange?.(e.target.value); }}
                    className="appearance-none w-44 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-1.5 pl-3 pr-8 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-600 cursor-pointer transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    disabled={isLoading || isDownloading || isPlaying}
                >
                    {voices.map(voice => (
                        <option key={voice.name} value={voice.name}>
                            {voiceDisplayNames?.[voice.name] || `${voice.name} (${voice.analysis.gender})`}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                    <ChevronDown size={14} />
                </div>
            </div>
            )}

            {/* Accent Selector (optional, provided via props) */}
            {accentOptions && accentOptions.length > 0 && onAccentChange && (
            <div className="relative group">
                <select
                    value={selectedAccentId || ''}
                    onChange={(e) => onAccentChange(e.target.value)}
                    className="appearance-none w-40 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-1.5 pl-3 pr-8 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-600 cursor-pointer transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    disabled={isLoading || isDownloading || isPlaying}
                    title="Voice accent"
                >
                    {accentOptions.map(accent => (
                        <option key={accent.id} value={accent.id}>{accent.label}</option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                    <ChevronDown size={14} />
                </div>
            </div>
            )}

            {/* Language Selector */}
            <div className="relative group">
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none text-zinc-400 dark:text-zinc-500">
                    <Globe size={12} />
                </div>
                <select
                    value={languageCode}
                    onChange={(e) => {
                      const val = e.target.value;
                      pushUndo(getCurrentSnapshot());
                      setLanguageCode(val);
                      // Mark as user override unless they picked auto-detect
                      userOverrodeLangRef.current = val !== '';
                    }}
                    className="appearance-none w-40 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-1.5 pl-7 pr-8 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-600 cursor-pointer transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    disabled={isLoading || isDownloading || isPlaying}
                >
                    {TTS_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                            {lang.code === '' && autoDetectedLang
                              ? `Auto-detect (${TTS_LANGUAGES.find(l => l.code === autoDetectedLang)?.label || autoDetectedLang})`
                              : lang.label}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                    <ChevronDown size={14} />
                </div>
            </div>

            {/* Playback Speed */}
            <div className="relative group">
                <select
                    value={playbackSpeed}
                    onChange={(e) => { pushUndo(getCurrentSnapshot()); setPlaybackSpeed(Number(e.target.value)); }}
                    className="appearance-none w-16 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-1.5 pl-2 pr-6 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-600 cursor-pointer transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800 text-center"
                    disabled={isLoading || isDownloading}
                >
                    <option value={0.5}>0.5×</option>
                    <option value={0.75}>0.75×</option>
                    <option value={1}>1×</option>
                    <option value={1.25}>1.25×</option>
                    <option value={1.5}>1.5×</option>
                    <option value={2}>2×</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-zinc-400">
                    <ChevronDown size={12} />
                </div>
            </div>

            {/* Model Selector */}
            <div className="relative group">
                <select
                    value={ttsModel}
                    onChange={(e) => { pushUndo(getCurrentSnapshot()); setTtsModel(e.target.value); setAudioData(null); }}
                    className="appearance-none w-36 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-1.5 pl-2.5 pr-7 rounded-lg text-xs font-medium focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-600 cursor-pointer transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    disabled={isLoading || isDownloading || isPlaying}
                    title="TTS model"
                >
                    <option value="gemini-3.1-flash-tts-preview">3.1 Flash TTS</option>
                    <option value="gemini-2.5-flash-preview-tts">2.5 Flash TTS</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1.5 text-zinc-400">
                    <ChevronDown size={12} />
                </div>
            </div>

            {/* Undo / Redo */}
            <div className="flex items-center gap-1">
                <button
                    onClick={handleUndo}
                    disabled={!canUndo || isLoading || isPlaying}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Undo settings change (Ctrl+Z)"
                >
                    <Undo2 size={14} />
                </button>
                <button
                    onClick={handleRedo}
                    disabled={!canRedo || isLoading || isPlaying}
                    className="flex items-center justify-center w-8 h-8 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Redo settings change (Ctrl+Shift+Z)"
                >
                    <Redo2 size={14} />
                </button>
            </div>

            {/* Streaming Toggle */}
            <button
                onClick={() => { pushUndo(getCurrentSnapshot()); setUseStreaming(!useStreaming); }}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  useStreaming
                    ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-600 dark:text-amber-400'
                    : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
                title={useStreaming ? 'Streaming enabled — plays audio as it generates' : 'Enable streaming playback'}
                disabled={isLoading || isPlaying}
            >
                <Zap size={12} className={useStreaming ? 'text-amber-500' : ''} />
                Stream
            </button>

            {/* Actions */}
            <div className="flex items-center gap-1.5 ml-auto">
                {onSavePreset && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onSavePreset({
                                voiceName: selectedVoiceName,
                                text,
                                systemInstruction: systemInstruction || '',
                                audioBase64: audioData,
                                sourceQuery: sourceQuery || '',
                            });
                        }}
                        disabled={isLoading || isDownloading}
                        className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-full text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Save as Custom Preset"
                    >
                        <Save size={14} />
                        <span className="hidden sm:inline">Save Preset</span>
                    </button>
                )}
                <button
                    onClick={handleDownload}
                    disabled={isLoading || isDownloading || !text.trim()}
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${isDownloading ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400 cursor-wait' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Download Audio"
                >
                    {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                </button>
                {/* Play Button */}
                <button
                    onClick={handlePlay}
                    disabled={isLoading || isDownloading || !text.trim()}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-300 transform active:scale-95 ${
                        isPlaying 
                        ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-200 dark:hover:bg-zinc-600' 
                        : 'bg-zinc-900 dark:bg-indigo-600 text-white hover:bg-zinc-800 dark:hover:bg-indigo-500 shadow-md'
                    } ${(isLoading || isDownloading || !text.trim()) ? 'cursor-not-allowed opacity-70' : ''}`}
                >
                    {isLoading ? (
                        <Loader2 size={16} className="animate-spin" />
                    ) : isPlaying ? (
                        <Square size={16} className="fill-current" />
                    ) : (
                        <Play size={16} className="fill-current" />
                    )}
                    <span>{isLoading ? 'Generating...' : isPlaying ? 'Stop Preview' : 'Listen'}</span>
                </button>
            </div>
        </div>

        {/* Visualizer Area */}
        <div 
            className={`h-24 relative flex items-center justify-center bg-zinc-50 dark:bg-zinc-900 overflow-hidden group ${(isLoading || isDownloading || !text.trim()) ? 'cursor-not-allowed' : 'cursor-pointer'}`} 
            onClick={handlePlay}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') handlePlay(); }}
            aria-label={isPlaying ? "Stop audio preview" : "Play audio preview"}
        >
             {/* Grid Background */}
             <div className="absolute inset-0 opacity-[0.05] dark:opacity-[0.1]" style={{ backgroundImage: 'radial-gradient(currentColor 1px, transparent 1px)', backgroundSize: '8px 8px' }}></div>
            
             {/* Icon or Visualizer */}
             <div className="w-full h-full absolute inset-0 flex items-center justify-center pointer-events-none">
                 {isPlaying ? (
                     <div className="w-full h-full opacity-80">
                         <AudioVisualizer isPlaying={true} color={document.documentElement.classList.contains('dark') ? '#a5b4fc' : '#18181b'} />
                     </div>
                 ) : (
                     <div className="flex flex-col items-center gap-2 text-zinc-300 dark:text-zinc-600">
                         <Volume2 size={24} />
                         <span className="text-xs font-medium">Click to preview audio</span>
                     </div>
                 )}
             </div>

             {/* Error Message */}
             {error && (
                 <div className="absolute inset-0 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-center text-red-500 dark:text-red-400 gap-2 text-sm z-20">
                     <AlertCircle size={16} />
                     <span>{error}</span>
                 </div>
             )}
        </div>
    </div>
  );
};

export default AiTtsPreview;
