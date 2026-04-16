/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * types.ts — Shared TypeScript Interfaces
 *
 * Central type definitions used across all frontend components. Voice and
 * VoiceAnalysis model the 30-voice library from constants.ts. FilterState
 * drives the search/filter bar. AiRecommendation captures structured output
 * from the Gemini recommendation endpoint.
 */

/** Detailed analysis metadata for a single voice. */
export interface VoiceAnalysis {
  gender: string;
  pitch: string;
  characteristics: string[];
  visualDescription: string;
}

/** A single voice in the Gemini TTS library, including sample URLs and analysis. */
export interface Voice {
  name: string;
  pitch: string;
  characteristics: string[];
  audioSampleUrl: string;
  fileUri: string;
  analysis: VoiceAnalysis;
  // Added for UI rendering
  imageUrl: string; 
}

/** Current search and filter criteria applied to the voice browser. */
export interface FilterState {
  gender: string | 'All';
  pitch: string | 'All';
  search: string;
}

/** Structured AI recommendation returned by the Gemini voice casting endpoint. */
export interface AiRecommendation {
  voiceNames: string[];
  systemInstruction: string;
  sampleText: string;
  sourceQuery?: string;
}

/** A user-saved voice preset created from an AI recommendation. */
export interface CustomPreset {
  id: number;
  name: string;
  voice_name: string;
  system_instruction: string | null;
  sample_text: string | null;
  audio_path: string | null;
  source_query: string | null;
  metadata_json: string | null;
  created_at: string;
  updated_at: string;
}

/** Maps a speaker label to a Gemini TTS voice name for multi-speaker dialogue. */
export interface SpeakerConfig {
  speaker: string;
  voiceName: string;
}