/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * api.ts — Frontend API Client
 *
 * Typed abstraction layer for every Go backend endpoint. All Gemini AI calls
 * are proxied through the backend — the frontend never contacts Gemini directly.
 *
 * Endpoint groups:
 *   /api/voices      — voice listing, AI recommendations, TTS generation
 *   /api/keys        — encrypted API key CRUD and validation
 *   /api/config      — key-value app config (theme, etc.)
 *   /api/history     — generation history with cached audio retrieval
 *   /api/health      — backend health check
 *
 * In development, Vite proxies /api to http://localhost:8080. In production,
 * the Go binary serves both the SPA and API on the same port.
 */

import { AiRecommendation, Voice, CustomPreset } from './types';

/** Base path for all API requests; proxied to Go backend in dev. */
const API_BASE = '/api';

/**
 * Generic fetch wrapper with JSON content-type and error handling.
 * Throws on non-OK responses with the response body as the error message.
 */
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(body || `Request failed: ${res.status}`);
  }
  return res.json();
}

// --- Voices ---

/** Fetch the full voice catalogue from the backend database. */
export async function getVoices(): Promise<Voice[]> {
  return request<Voice[]>('/voices');
}

/**
 * Request AI voice recommendations from Gemini via the backend proxy.
 * Sends the user's query and the full voice catalogue for context.
 */
export async function recommendVoices(query: string, voices: { name: string; gender: string; pitch: string; characteristics: string[] }[]): Promise<AiRecommendation> {
  return request<AiRecommendation>('/voices/recommend', {
    method: 'POST',
    body: JSON.stringify({ query, voices }),
  });
}

/**
 * Generate TTS audio via the Gemini backend proxy.
 * Returns base64-encoded raw PCM audio (24kHz, 16-bit, mono).
 * An optional systemInstruction shapes the voice's delivery style.
 */
export async function generateTts(text: string, voiceName: string, systemInstruction?: string): Promise<string> {
  const body: Record<string, string> = { text, voiceName };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  const data = await request<{ audioBase64: string }>('/voices/tts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.audioBase64;
}

// --- API Keys ---

/** Metadata for a stored API key (the actual key value is never sent to the frontend). */
export interface APIKeyInfo {
  id: number;
  provider: string;
  created_at: string;
  updated_at: string;
}

/** List all stored API key providers (without exposing key values). */
export async function listApiKeys(): Promise<APIKeyInfo[]> {
  return request<APIKeyInfo[]>('/keys');
}

/** Save an API key for the given provider; the backend encrypts it at rest. */
export async function storeApiKey(provider: string, key: string): Promise<void> {
  await request<void>('/keys', {
    method: 'POST',
    body: JSON.stringify({ provider, key }),
  });
}

/** Delete the stored API key for the given provider. */
export async function deleteApiKey(provider: string): Promise<void> {
  await request<void>(`/keys/${encodeURIComponent(provider)}`, {
    method: 'DELETE',
  });
}

/** Validate the stored API key by making a lightweight Gemini API call. */
export async function testApiKey(provider: string): Promise<{ valid: boolean; message: string }> {
  return request<{ valid: boolean; message: string }>(`/keys/${encodeURIComponent(provider)}/test`);
}

// --- Config ---

/** Retrieve all key-value config pairs from the backend. */
export async function getConfig(): Promise<Record<string, string>> {
  return request<Record<string, string>>('/config');
}

/** Upsert one or more config key-value pairs. */
export async function updateConfig(config: Record<string, string>): Promise<void> {
  await request<void>('/config', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

// --- History ---

/** A single history entry (TTS generation or recommendation) stored in the backend. */
export interface HistoryEntry {
  id: number;
  type: 'tts' | 'recommendation';
  voice_name: string | null;
  input_text: string;
  result_json: string | null;
  audio_path: string | null;
  created_at: string;
}

/** Fetch paginated history entries, optionally filtered by type ('tts' | 'recommendation'). */
export async function getHistory(type?: string, limit = 50, offset = 0): Promise<HistoryEntry[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  params.set('limit', String(limit));
  params.set('offset', String(offset));
  return request<HistoryEntry[]>(`/history?${params.toString()}`);
}

/** Fetch a single history entry by ID. */
export async function getHistoryEntry(id: number): Promise<HistoryEntry> {
  return request<HistoryEntry>(`/history/${id}`);
}

/** Delete a single history entry by ID. */
export async function deleteHistoryEntry(id: number): Promise<void> {
  await request<void>(`/history/${id}`, { method: 'DELETE' });
}

/** Retrieve cached TTS audio for a history entry as a base64-encoded PCM string. */
export async function getHistoryAudio(id: number): Promise<string> {
  const data = await request<{ audioBase64: string }>(`/history/${id}/audio`);
  return data.audioBase64;
}

/** Delete all history entries. */
export async function clearHistory(): Promise<void> {
  await request<void>('/history', { method: 'DELETE' });
}

// --- Health ---

/** Check if the backend is running and healthy. */
export async function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>('/health');
}

// --- Custom Presets ---

/** List all custom voice presets. */
export async function listPresets(): Promise<CustomPreset[]> {
  return request<CustomPreset[]>('/presets');
}

/** Get a single custom preset by ID. */
export async function getPreset(id: number): Promise<CustomPreset> {
  return request<CustomPreset>(`/presets/${id}`);
}

/** Create a new custom voice preset, optionally with cached audio. */
export async function createPreset(data: {
  name: string;
  voice_name: string;
  system_instruction?: string;
  sample_text?: string;
  audio_base64?: string;
  source_query?: string;
  metadata_json?: string;
}): Promise<{ id: number }> {
  return request<{ id: number }>('/presets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Update a custom preset's mutable fields. */
export async function updatePreset(id: number, data: {
  name?: string;
  sample_text?: string;
  audio_base64?: string;
  metadata_json?: string;
}): Promise<void> {
  await request<void>(`/presets/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

/** Delete a custom preset and its cached audio. */
export async function deletePreset(id: number): Promise<void> {
  await request<void>(`/presets/${id}`, { method: 'DELETE' });
}

/** Retrieve cached audio for a preset as base64 PCM. */
export async function getPresetAudio(id: number): Promise<string> {
  const data = await request<{ audioBase64: string }>(`/presets/${id}/audio`);
  return data.audioBase64;
}
