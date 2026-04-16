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
 * downloaded as a proper WAV file with RIFF headers. Includes an
 * AudioVisualizer canvas and a voice selector dropdown.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Play, Square, Loader2, Volume2, AlertCircle, ChevronDown, Download, Save, Globe } from 'lucide-react';
import { generateTts } from '../api';
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

const AiTtsPreview: React.FC<AiTtsPreviewProps> = ({ text, voices, systemInstruction, sourceQuery, hideVoiceSelector, onSavePreset }) => {
  const [selectedVoiceName, setSelectedVoiceName] = useState(voices[0]?.name || '');
  const [languageCode, setLanguageCode] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioData, setAudioData] = useState<string | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
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

  useEffect(() => {
    setAudioData(null);
    stopAudio();
  }, [text, selectedVoiceName, languageCode]);

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
      const audioDataBase64 = await generateTts(text, selectedVoiceName, systemInstruction, languageCode || undefined);
      
      if (!isMountedRef.current) return null;

      setAudioData(audioDataBase64);
      return audioDataBase64;
    } catch (err: any) {
      console.error("TTS Error:", err);
      if (isMountedRef.current) setError("Failed to generate speech. Please try again.");
      return null;
    }
  };

  /** Play/pause toggle: generates audio if not cached, then plays via Web Audio API. */
  const handlePlay = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isLoading || isDownloading || !text.trim()) return;

    if (isPlaying) {
      stopAudio();
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
        <div className="p-4 flex flex-col sm:flex-row gap-4 items-center justify-between bg-white dark:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-700">
            
            {/* Voice Selector */}
            {!hideVoiceSelector && (
            <div className="relative group w-full sm:w-auto">
                <select
                    value={selectedVoiceName}
                    onChange={(e) => setSelectedVoiceName(e.target.value)}
                    className="appearance-none w-full sm:w-48 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-2 pl-3 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-600 cursor-pointer transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    disabled={isLoading || isDownloading || isPlaying}
                >
                    {voices.map(voice => (
                        <option key={voice.name} value={voice.name}>
                            {voice.name} ({voice.analysis.gender})
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                    <ChevronDown size={14} />
                </div>
            </div>
            )}

            {/* Language Selector */}
            <div className="relative group w-full sm:w-auto">
                <div className="absolute inset-y-0 left-0 flex items-center pl-2.5 pointer-events-none text-zinc-400 dark:text-zinc-500">
                    <Globe size={14} />
                </div>
                <select
                    value={languageCode}
                    onChange={(e) => setLanguageCode(e.target.value)}
                    className="appearance-none w-full sm:w-44 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 py-2 pl-8 pr-10 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-zinc-200 dark:focus:ring-zinc-600 cursor-pointer transition-all hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    disabled={isLoading || isDownloading || isPlaying}
                >
                    {TTS_LANGUAGES.map(lang => (
                        <option key={lang.code} value={lang.code}>
                            {lang.label}
                        </option>
                    ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-zinc-400">
                    <ChevronDown size={14} />
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
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
                        className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-300 rounded-full text-xs font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Save as Custom Preset"
                    >
                        <Save size={14} />
                        <span className="hidden sm:inline">Save Preset</span>
                    </button>
                )}
                <button
                    onClick={handleDownload}
                    disabled={isLoading || isDownloading || !text.trim()}
                    className={`flex items-center justify-center w-10 h-10 rounded-full transition-colors ${isDownloading ? 'bg-zinc-100 dark:bg-zinc-700 text-zinc-400 cursor-wait' : 'bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-600'} disabled:opacity-50 disabled:cursor-not-allowed`}
                    title="Download Audio"
                >
                    {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                </button>
                {/* Play Button */}
                <button
                    onClick={handlePlay}
                    disabled={isLoading || isDownloading || !text.trim()}
                    className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 transform active:scale-95 ${
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
