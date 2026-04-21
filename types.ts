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

/** Grid density controls column count and card size. */
export type GridDensity = 'compact' | 'comfortable' | 'spacious';

/** Structured AI recommendation returned by the Gemini voice casting endpoint. */
export interface AiRecommendation {
  voiceNames: string[];
  systemInstruction: string;
  sampleText: string;
  sourceQuery?: string;
  personDescription?: string;
}

export interface PresetCastingDirectorMetadata {
  sourceQuery?: string;
  personDescription?: string;
}

export interface PresetHeadshotMetadata {
  status?: string;
  prompt?: string;
  mimeType?: string;
  path?: string;
  error?: string;
  generatedAt?: string;
  aspectRatio?: string;
  imageSize?: string;
  model?: string;
}

export interface PresetMetadata {
  castingDirector?: PresetCastingDirectorMetadata;
  headshot?: PresetHeadshotMetadata;
}

/** A user-saved voice preset created from an AI recommendation. */
/** A tag attached to a custom preset for categorization. */
export interface PresetTag {
  id?: number;
  preset_id?: number;
  tag: string;
  color: string;
}

export interface CustomPreset {
  id: number;
  name: string;
  voice_name: string;
  system_instruction: string | null;
  sample_text: string | null;
  audio_path: string | null;
  source_query: string | null;
  metadata_json: string | null;
  color: string;
  sort_order: number;
  tags: PresetTag[];
  created_at: string;
  updated_at: string;
}

/** Maps a speaker label to a Gemini TTS voice name for multi-speaker dialogue. */
export interface SpeakerConfig {
  speaker: string;
  voiceName: string;
}