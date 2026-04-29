/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * AudioProvider.tsx — Global Audio Playback Context
 *
 * Provides a single shared AudioContext for the entire app, ensuring only one
 * audio source plays at a time. Exposes playPcm(), playUrl(), stop(), and
 * playback state so any component can trigger audio and the MiniPlayer can
 * display current track info.
 */

import React, { createContext, useContext, useRef, useState, useCallback, useEffect } from 'react';

/** Metadata about the currently playing track. */
export interface TrackInfo {
  /** Display label (voice name, preset name, etc.) */
  label: string;
  /** Optional subtitle (e.g. truncated script text) */
  subtitle?: string;
  /** 'sample' for stock voice previews, 'tts' for generated speech, 'history' for cached playback */
  source: 'sample' | 'tts' | 'history';
}

interface AudioContextValue {
  /** Play raw base64-encoded PCM audio (24kHz 16-bit mono). */
  playPcm: (base64: string, track: TrackInfo) => Promise<void>;
  /** Play an audio URL (e.g. stock voice sample WAV). */
  playUrl: (url: string, track: TrackInfo) => void;
  /** Stop any currently playing audio. */
  stop: () => void;
  /** Whether audio is currently playing. */
  isPlaying: boolean;
  /** Info about the current track, or null if nothing is playing. */
  currentTrack: TrackInfo | null;
  /** Playback progress 0-1 (only for PCM, approximate). */
  progress: number;
  /** Duration in seconds (only for PCM). */
  duration: number;
}

const AudioProviderContext = createContext<AudioContextValue | null>(null);

/** Access the shared audio controller from components inside AudioProvider. */
export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioProviderContext);
  if (!ctx) throw new Error('useAudio must be used within an AudioProvider');
  return ctx;
}

/** Decode a base64 string into a raw Uint8Array. */
function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/** Provide single-source audio playback state and controls for the app. */
export const AudioProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<TrackInfo | null>(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const progressTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const isMountedRef = useRef(true);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (progressTimerRef.current) cancelAnimationFrame(progressTimerRef.current);
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.stop(); } catch { /* ignore */ }
      }
      if (audioElRef.current) {
        audioElRef.current.pause();
        audioElRef.current.src = '';
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const clearProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      cancelAnimationFrame(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    clearProgressTimer();
    // Stop Web Audio source
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch { /* ignore */ }
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
    }
    // Stop HTML audio element
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.src = '';
      audioElRef.current = null;
    }
    setIsPlaying(false);
    setCurrentTrack(null);
    setProgress(0);
    setDuration(0);
  }, [clearProgressTimer]);

  const startProgressTracking = useCallback((dur: number) => {
    startTimeRef.current = performance.now();
    setDuration(dur);
    const tick = () => {
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      setProgress(Math.min(elapsed / dur, 1));
      if (elapsed < dur) {
        progressTimerRef.current = requestAnimationFrame(tick);
      }
    };
    progressTimerRef.current = requestAnimationFrame(tick);
  }, []);

  const playPcm = useCallback(async (base64: string, track: TrackInfo) => {
    stop();
    const ctx = getAudioContext();

    const raw = decodeBase64(base64);
    const int16 = new Int16Array(raw.buffer);
    const frameCount = int16.length;
    const buffer = ctx.createBuffer(1, frameCount, 24000);
    const channelData = buffer.getChannelData(0);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = int16[i] / 32768.0;
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    sourceNodeRef.current = source;

    setCurrentTrack(track);
    setIsPlaying(true);

    const dur = buffer.duration;
    startProgressTracking(dur);

    source.onended = () => {
      clearProgressTimer();
      if (!isMountedRef.current) return;
      setIsPlaying(false);
      setCurrentTrack(null);
      setProgress(0);
      sourceNodeRef.current = null;
    };

    source.start();
  }, [stop, getAudioContext, startProgressTracking, clearProgressTimer]);

  const playUrl = useCallback((url: string, track: TrackInfo) => {
    stop();
    const audio = new Audio(url);
    audioElRef.current = audio;

    setCurrentTrack(track);
    setIsPlaying(true);

    audio.onended = () => {
      clearProgressTimer();
      if (!isMountedRef.current) return;
      setIsPlaying(false);
      setCurrentTrack(null);
      setProgress(0);
      audioElRef.current = null;
    };

    audio.ontimeupdate = () => {
      if (!isMountedRef.current) return;
      if (audio.duration && isFinite(audio.duration)) {
        setProgress(audio.currentTime / audio.duration);
        setDuration(audio.duration);
      }
    };

    audio.onerror = () => {
      if (!isMountedRef.current) return;
      setIsPlaying(false);
      setCurrentTrack(null);
      audioElRef.current = null;
    };

    audio.play().catch(() => {
      if (!isMountedRef.current) return;
      setIsPlaying(false);
      setCurrentTrack(null);
    });
  }, [stop, clearProgressTimer]);

  return (
    <AudioProviderContext.Provider value={{ playPcm, playUrl, stop, isPlaying, currentTrack, progress, duration }}>
      {children}
    </AudioProviderContext.Provider>
  );
};
