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

import { AiRecommendation, Voice, CustomPreset, PresetTag } from './types';

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
 * An optional languageCode (e.g. "en", "es") overrides automatic language detection.
 */
export async function generateTts(text: string, voiceName: string, systemInstruction?: string, languageCode?: string, model?: string, provider?: string): Promise<string> {
  const body: Record<string, string> = { text, voiceName };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (languageCode) body.languageCode = languageCode;
  if (model) body.model = model;
  if (provider) body.provider = provider;
  const data = await request<{ audioBase64: string }>('/voices/tts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.audioBase64;
}

/**
 * Generate multi-speaker dialogue TTS audio via the Gemini backend proxy.
 * Returns base64-encoded raw PCM audio (24kHz, 16-bit, mono).
 */
export async function generateMultiSpeakerTts(
  text: string,
  speakers: { speaker: string; voiceName: string }[],
  languageCode?: string,
  model?: string
): Promise<string> {
  const body: Record<string, any> = { text, speakers };
  if (languageCode) body.languageCode = languageCode;
  if (model) body.model = model;
  const data = await request<{ audioBase64: string }>('/voices/tts/multi', {
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

// --- API Key Pool (rotation) ---

/** Metadata for a key in the rotation pool. */
export interface APIKeyPoolEntry {
  id: number;
  provider: string;
  label: string;
  is_active: boolean;
  error_count: number;
  last_used_at: string;
  created_at: string;
  updated_at: string;
}

/** List all keys in the rotation pool for a provider. */
export async function listKeyPool(provider: string): Promise<APIKeyPoolEntry[]> {
  return request<APIKeyPoolEntry[]>(`/keys/${encodeURIComponent(provider)}/pool`);
}

/** Add a new key to the rotation pool. */
export async function addKeyToPool(provider: string, key: string, label?: string): Promise<{ id: number; status: string }> {
  return request<{ id: number; status: string }>(`/keys/${encodeURIComponent(provider)}/pool`, {
    method: 'POST',
    body: JSON.stringify({ key, label: label || '' }),
  });
}

/** Remove a key from the rotation pool. */
export async function deleteKeyFromPool(provider: string, id: number): Promise<void> {
  await request<void>(`/keys/${encodeURIComponent(provider)}/pool`, {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
}

/** Reset error count and reactivate a pool key. */
export async function resetPoolKey(provider: string, id: number): Promise<void> {
  await request<void>(`/keys/${encodeURIComponent(provider)}/pool/reset`, {
    method: 'POST',
    body: JSON.stringify({ id }),
  });
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

/** Optional filters for fetching history entries. */
export interface HistoryFilters {
  type?: string;
  q?: string;
  voice?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** Fetch paginated history entries with optional filters. */
export async function getHistory(filters: HistoryFilters = {}): Promise<HistoryEntry[]> {
  const params = new URLSearchParams();
  if (filters.type) params.set('type', filters.type);
  if (filters.q) params.set('q', filters.q);
  if (filters.voice) params.set('voice', filters.voice);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  params.set('limit', String(filters.limit ?? 50));
  params.set('offset', String(filters.offset ?? 0));
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

/** Get the export URL for history (opens direct download). */
export function getHistoryExportUrl(format: 'csv' | 'json' = 'json'): string {
  return `${API_BASE}/history/export?format=${format}`;
}

// --- Health ---

/** Check if the backend is running and healthy. */
export async function getHealth(): Promise<{ status: string }> {
  return request<{ status: string }>('/health');
}

// --- Audio Cache ---

/** Cache stats response. */
export interface CacheStats {
  total_size: number;
  file_count: number;
  cache_dir: string;
}

/** Get audio cache statistics. */
export async function getCacheStats(): Promise<CacheStats> {
  return request<CacheStats>('/cache/stats');
}

/** Clear the audio cache. */
export async function clearCache(): Promise<{ status: string; removed: number }> {
  return request<{ status: string; removed: number }>('/cache', { method: 'DELETE' });
}

// --- Backup & Restore ---

/** Create a database backup and download it. */
export async function createBackup(): Promise<void> {
  const response = await fetch(`${API_BASE}/backup`, { method: 'POST' });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Backup failed');
  }
  const blob = await response.blob();
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="(.+)"/);
  const filename = match ? match[1] : 'gemini-voice-backup.db';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Restore the database from an uploaded backup file. */
export async function restoreBackup(file: File): Promise<{ status: string }> {
  const form = new FormData();
  form.append('backup', file);
  const response = await fetch(`${API_BASE}/restore`, {
    method: 'POST',
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Restore failed');
  }
  return response.json();
}

// --- WebSocket Progress ---

/** Progress event received from the WebSocket. */
export interface ProgressEvent {
  job_id: string;
  type: string;
  status: string;
  message?: string;
  percent: number;
}

/** Connect to the WebSocket progress endpoint. Returns a cleanup function. */
export function connectProgress(onEvent: (event: ProgressEvent) => void): () => void {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const url = `${protocol}//${window.location.host}/api/ws/progress`;
  let ws: WebSocket | null = new WebSocket(url);
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    ws = new WebSocket(url);
    ws.onmessage = (e) => {
      try {
        const event = JSON.parse(e.data) as ProgressEvent;
        onEvent(event);
      } catch { /* ignore malformed */ }
    };
    ws.onclose = () => {
      // Auto-reconnect after 3s
      reconnectTimer = setTimeout(connect, 3000);
    };
  };

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as ProgressEvent;
      onEvent(event);
    } catch { /* ignore */ }
  };
  ws.onclose = () => {
    reconnectTimer = setTimeout(connect, 3000);
  };

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.onclose = null;
      ws.close();
      ws = null;
    }
  };
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
  generate_headshot?: boolean;
  person_description?: string;
}): Promise<{ id: number }> {
  return request<{ id: number }>('/presets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Update a custom preset's mutable fields. */
export async function updatePreset(id: number, data: {
  name?: string;
  system_instruction?: string;
  sample_text?: string;
  audio_base64?: string;
  metadata_json?: string;
  color?: string;
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

/** Retrieve a generated preset headshot image URL for direct img src usage. */
export function getPresetImageUrl(id: number): string {
  return `${API_BASE}/presets/${id}/image`;
}

/** Regenerate the headshot for a preset using its stored personDescription. */
export async function regeneratePresetImage(id: number): Promise<CustomPreset> {
  return request<CustomPreset>(`/presets/${id}/image/regenerate`, { method: 'POST' });
}

/** List all distinct tags across all presets. */
export async function listAllTags(): Promise<PresetTag[]> {
  return request<PresetTag[]>('/presets/tags');
}

/** Replace all tags for a given preset. */
export async function setPresetTags(presetId: number, tags: { tag: string; color: string }[]): Promise<void> {
  await request<void>(`/presets/${presetId}/tags`, {
    method: 'PUT',
    body: JSON.stringify({ tags }),
  });
}

/** Export all presets as JSON (triggers download). */
export async function exportPresets(): Promise<void> {
  const res = await fetch(`${API_BASE}/presets/export`);
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'voice-presets.json';
  a.click();
  URL.revokeObjectURL(url);
}

/** Import presets from a JSON array. Returns count of imported and skipped. */
export async function importPresets(data: unknown[]): Promise<{ imported: number; skipped: number }> {
  return request<{ imported: number; skipped: number }>('/presets/import', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

/** Reorder presets by providing an ordered array of preset IDs. */
export async function reorderPresets(orderedIds: number[]): Promise<void> {
  await request<void>('/presets/reorder', {
    method: 'PATCH',
    body: JSON.stringify({ ordered_ids: orderedIds }),
  });
}

/** A preset version snapshot. */
export interface PresetVersion {
  id: number;
  preset_id: number;
  name: string;
  voice_name: string;
  system_instruction: string;
  sample_text: string;
  color: string;
  metadata_json?: string;
  created_at: string;
}

/** List version history for a preset. */
export async function listPresetVersions(presetId: number): Promise<PresetVersion[]> {
  return request<PresetVersion[]>(`/presets/${presetId}/versions`);
}

/** Revert a preset to a specific version. Returns the updated preset. */
export async function revertPresetVersion(presetId: number, versionId: number): Promise<CustomPreset> {
  return request<CustomPreset>(`/presets/${presetId}/versions/${versionId}/revert`, { method: 'POST' });
}

// --- Favorites ---

/** List all favorited voice names. */
export async function listFavorites(): Promise<string[]> {
  return request<string[]>('/favorites');
}

/** Add or remove a voice from favorites. */
export async function toggleFavorite(voiceName: string, favorite: boolean): Promise<void> {
  await request<{ ok: boolean }>('/favorites', {
    method: 'POST',
    body: JSON.stringify({ voice_name: voiceName, favorite }),
  });
}

/** Use Gemini to reformat raw script text into optimised TTS prompt structure. */
export async function formatScript(script: string): Promise<string> {
  const data = await request<{ formatted: string }>('/voices/format-script', {
    method: 'POST',
    body: JSON.stringify({ script }),
  });
  return data.formatted;
}

/** Stream TTS audio chunks via SSE. Calls onChunk with each base64 audio fragment. */
export async function streamTts(
  text: string,
  voiceName: string,
  opts: {
    systemInstruction?: string;
    languageCode?: string;
    model?: string;
    onChunk: (audioBase64: string, index: number) => void;
    onDone: () => void;
    onError: (error: string) => void;
    signal?: AbortSignal;
  }
): Promise<void> {
  const body: Record<string, string> = { text, voiceName };
  if (opts.systemInstruction) body.systemInstruction = opts.systemInstruction;
  if (opts.languageCode) body.languageCode = opts.languageCode;
  if (opts.model) body.model = opts.model;

  const resp = await fetch(`${API_BASE}/voices/tts/stream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(err || `HTTP ${resp.status}`);
  }

  const reader = resp.body?.getReader();
  if (!reader) throw new Error('ReadableStream not supported');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const json = line.slice(6).trim();
      if (!json) continue;
      try {
        const parsed = JSON.parse(json);
        if (parsed.error) { opts.onError(parsed.error); return; }
        if (parsed.done) { opts.onDone(); return; }
        if (parsed.audioBase64) { opts.onChunk(parsed.audioBase64, parsed.index); }
      } catch {}
    }
  }
  opts.onDone();
}
