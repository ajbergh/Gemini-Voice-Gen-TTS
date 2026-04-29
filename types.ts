/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * types.ts — Shared TypeScript Interfaces
 *
 * Central frontend data contracts for the voice library, saved presets,
 * script-project workspace, take review, QC, clients, providers, export
 * packaging, and AI script-prep workflows.
 *
 * These interfaces mirror the JSON payloads returned by the Go backend and are
 * intentionally snake_case where the persisted API schema uses snake_case.
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

/** Stored metadata for AI casting-director context attached to a preset. */
export interface PresetCastingDirectorMetadata {
  sourceQuery?: string;
  personDescription?: string;
}

/** Stored metadata for a generated preset portrait/headshot asset. */
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

/** A tag attached to a custom preset for categorization. */
export interface PresetTag {
  id?: number;
  preset_id?: number;
  tag: string;
  color: string;
}

/** A user-saved voice preset, optionally with cached audio, tags, and metadata. */
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

export type ProjectKind = 'audiobook' | 'voiceover' | 'podcast' | 'training' | 'character_reel' | 'other';
export type ProjectStatus = 'draft' | 'active' | 'archived';
export type ScriptSectionKind = 'chapter' | 'scene' | 'folder';
export type SegmentStatus = 'draft' | 'changed' | 'queued' | 'rendering' | 'failed' | 'rendered' | 'approved' | 'flagged' | 'locked';
export type CastRole = 'narrator' | 'protagonist' | 'antagonist' | 'supporting' | 'extra' | 'brand_voice' | 'archived';

/** Durable project-level container for long-form narration and voiceover work. */
export interface ScriptProject {
  id: number;
  title: string;
  kind: ProjectKind | string;
  description: string;
  status: ProjectStatus | string;
  default_voice_name?: string;
  default_preset_id?: number;
  default_style_id?: number;
  default_accent_id?: string;
  default_language_code?: string;
  default_provider?: string;
  default_model?: string;
  fallback_provider?: string;
  fallback_model?: string;
  client_id?: number;
  metadata_json?: string;
  created_at: string;
  updated_at: string;
}

/** List-level production counts for a project. */
export interface ProjectSummary {
  project_id: number;
  section_count: number;
  segment_count: number;
  rendered_count: number;
  approved_count: number;
  open_qc_count: number;
  updated_at: string;
}

/** Ordered project section such as a chapter, scene, or folder. */
export interface ScriptSection {
  id: number;
  project_id: number;
  parent_id?: number;
  kind: ScriptSectionKind | string;
  title: string;
  sort_order: number;
  metadata_json?: string;
  created_at: string;
  updated_at: string;
}

/** Renderable script unit with voice, cast, provider, and status metadata. */
export interface ScriptSegment {
  id: number;
  project_id: number;
  section_id?: number;
  title: string;
  script_text: string;
  speaker_label?: string;
  voice_name?: string;
  cast_profile_id?: number;
  preset_id?: number;
  style_id?: number;
  accent_id?: string;
  language_code?: string;
  provider?: string;
  model?: string;
  fallback_provider?: string;
  fallback_model?: string;
  status: SegmentStatus | string;
  content_hash: string;
  sort_order: number;
  metadata_json?: string;
  created_at: string;
  updated_at: string;
}

export type CreateScriptProjectInput = Partial<Omit<ScriptProject, 'id' | 'created_at' | 'updated_at'>> & Pick<ScriptProject, 'title'>;
export type UpdateScriptProjectInput = Partial<Omit<ScriptProject, 'id' | 'created_at' | 'updated_at'>> & Pick<ScriptProject, 'title'>;
export type CreateScriptSectionInput = Partial<Omit<ScriptSection, 'id' | 'project_id' | 'created_at' | 'updated_at'>> & Pick<ScriptSection, 'title'>;
export type UpdateScriptSectionInput = CreateScriptSectionInput;
export type CreateScriptSegmentInput = Partial<Omit<ScriptSegment, 'id' | 'project_id' | 'content_hash' | 'created_at' | 'updated_at'>>;
export type UpdateScriptSegmentInput = CreateScriptSegmentInput;

export interface ImportPreviewSegment {
  script_text: string;
}

export interface ImportPreviewSection {
  title: string;
  kind: ScriptSectionKind | string;
  segments: ImportPreviewSegment[];
}

export interface ImportPreview {
  sections: ImportPreviewSection[];
  unsectioned_segments: ImportPreviewSegment[];
  section_count: number;
  segment_count: number;
}

/** A single rendered audio take for a script segment. */
export interface SegmentTake {
  id: number;
  project_id: number;
  segment_id: number;
  take_number: number;
  voice_name?: string;
  speaker_label?: string;
  language_code?: string;
  provider?: string;
  model?: string;
  provider_voice?: string;
  app_voice_name?: string;
  preset_id?: number;
  style_id?: number;
  accent_id?: string;
  cast_profile_id?: number;
  dictionary_hash?: string;
  prompt_hash?: string;
  settings_json?: string;
  system_instruction?: string;
  script_text: string;
  audio_path?: string;
  duration_seconds?: number;
  peak_dbfs?: number;
  rms_dbfs?: number;
  clipping_detected?: boolean;
  sample_rate?: number;
  channels?: number;
  format?: string;
  content_hash: string;
  status: string;
  metadata_json?: string;
  created_at: string;
}

/** A reviewer note attached to a segment take. */
export interface TakeNote {
  id: number;
  take_id: number;
  note: string;
  created_at: string;
}

export type CreateTakeInput = Partial<Omit<SegmentTake, 'id' | 'project_id' | 'segment_id' | 'take_number' | 'content_hash' | 'created_at'>>;

/** A project cast bible profile for a narrator, character, or brand voice. */
export interface CastProfile {
  id: number;
  project_id: number;
  series_id?: number;
  name: string;
  role: CastRole | string;
  description: string;
  voice_name?: string;
  preset_id?: number;
  style_id?: number;
  accent_id?: string;
  language_code?: string;
  age_impression?: string;
  emotional_range?: string;
  sample_lines_json?: string;
  pronunciation_notes?: string;
  metadata_json?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/** A saved snapshot of a cast profile before an edit or revert. */
export interface CastProfileVersion {
  id: number;
  profile_id: number;
  name: string;
  role: CastRole | string;
  description: string;
  voice_name?: string;
  preset_id?: number;
  style_id?: number;
  accent_id?: string;
  language_code?: string;
  age_impression?: string;
  emotional_range?: string;
  sample_lines_json?: string;
  pronunciation_notes?: string;
  metadata_json?: string;
  sort_order: number;
  created_at: string;
}

export type CreateCastProfileInput = Partial<Omit<CastProfile, 'id' | 'project_id' | 'created_at' | 'updated_at'>> & Pick<CastProfile, 'name'>;
export type UpdateCastProfileInput = CreateCastProfileInput;

export interface CastAuditionInput {
  sample_text: string;
  voice_name?: string;
  preset_id?: number;
  style_id?: number;
}

export interface CastAuditionResponse {
  profile_id: number;
  voice_name: string;
  audioBase64: string;
  sample_text: string;
  preset_id?: number;
  style_id?: number;
  language_code?: string;
}

// ---------------------------------------------------------------------------
// Pronunciation dictionaries
// ---------------------------------------------------------------------------

export interface PronunciationDictionary {
  id: number;
  project_id: number;
  scope?: 'project' | 'global' | string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface PronunciationEntry {
  id: number;
  dictionary_id: number;
  raw_word: string;
  replacement: string;
  is_regex: boolean;
  enabled: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type CreateEntryInput = Pick<PronunciationEntry, 'raw_word' | 'replacement'> &
  Partial<Pick<PronunciationEntry, 'is_regex' | 'enabled' | 'sort_order'>>;

export interface PreviewResult {
  original: string;
  result: string;
  changed: number;
}

// ---------------------------------------------------------------------------
// Performance style presets
// ---------------------------------------------------------------------------

export type StyleCategory =
  | 'narration' | 'commercial' | 'education' | 'character'
  | 'wellness' | 'documentary' | 'trailer' | 'custom';

export interface PerformanceStyle {
  id: number;
  scope: 'global' | 'project' | string;
  project_id?: number;
  name: string;
  description: string;
  category: StyleCategory | string;
  pacing?: string;
  energy?: string;
  emotion?: string;
  articulation?: string;
  pause_density?: string;
  director_notes: string;
  audio_tags_json?: string;
  is_builtin: boolean;
  sort_order: number;
  metadata_json?: string;
  created_at: string;
  updated_at: string;
}

export interface PerformanceStyleVersion {
  id: number;
  style_id: number;
  name: string;
  description: string;
  category: StyleCategory | string;
  pacing?: string;
  energy?: string;
  emotion?: string;
  articulation?: string;
  pause_density?: string;
  director_notes: string;
  audio_tags_json?: string;
  metadata_json?: string;
  created_at: string;
}

export type CreateStyleInput = Partial<Omit<PerformanceStyle, 'id' | 'is_builtin' | 'created_at' | 'updated_at'>> & Pick<PerformanceStyle, 'name'>;
export type UpdateStyleInput = CreateStyleInput;

// ---------------------------------------------------------------------------
// Export profiles
// ---------------------------------------------------------------------------

export interface ExportProfile {
  id: number;
  name: string;
  target_kind: string;
  trim_silence: boolean;
  silence_threshold_db: number;
  leading_silence_ms: number;
  trailing_silence_ms: number;
  inter_segment_silence_ms: number;
  normalize_peak_db: number;
  is_builtin: boolean;
  metadata_json?: string;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// QC / Review workflow
// ---------------------------------------------------------------------------

export type QcIssueType =
  | 'pronunciation'
  | 'pacing'
  | 'tone'
  | 'volume'
  | 'artifact'
  | 'missing_pause'
  | 'wrong_voice'
  | 'bad_emphasis'
  | 'other';

export type QcIssueSeverity = 'low' | 'medium' | 'high';
export type QcIssueStatus = 'open' | 'resolved' | 'wont_fix';

export interface QcIssue {
  id: number;
  project_id: number;
  section_id?: number;
  segment_id: number;
  take_id?: number;
  issue_type: QcIssueType;
  severity: QcIssueSeverity;
  note: string;
  time_offset_seconds?: number;
  status: QcIssueStatus;
  created_at: string;
  updated_at: string;
}

export interface QcRollup {
  project_id: number;
  open_count: number;
  resolved_count: number;
  wont_fix_count: number;
}

export interface SegmentQcStatus {
  segment_id: number;
  open_count: number;
}

export type CreateQcIssueInput = {
  segment_id: number;
  issue_type?: QcIssueType;
  severity?: QcIssueSeverity;
  note?: string;
  time_offset_seconds?: number;
  take_id?: number;
  section_id?: number;
};

export type UpdateQcIssueInput = Partial<{
  issue_type: QcIssueType;
  severity: QcIssueSeverity;
  note: string;
  time_offset_seconds: number | null;
  status: QcIssueStatus;
  take_id: number | null;
}>;

// Review queue filter options
export type ReviewFilter = 'all' | 'unreviewed' | 'flagged' | 'open_issues';

// ── Plan 09: Client & Brand Voiceover Workspaces ──────────────────────────────

export interface Client {
  id: number;
  name: string;
  description: string;
  brand_notes: string;
  default_provider?: string;
  default_model?: string;
  fallback_provider?: string;
  fallback_model?: string;
  default_voice_name?: string;
  default_preset_id?: number;
  default_style_id?: number;
  default_export_profile_id?: number;
  metadata_json?: string;
  created_at: string;
  updated_at: string;
}

export interface ClientAsset {
  id: number;
  client_id: number;
  asset_type: 'preset' | 'style' | 'dictionary' | 'project' | 'export_profile';
  asset_id: number;
  label: string;
  created_at: string;
}

export type CreateClientInput = Omit<Client, 'id' | 'created_at' | 'updated_at'>;
export type UpdateClientInput = CreateClientInput;
export type CreateClientAssetInput = Omit<ClientAsset, 'id' | 'client_id' | 'created_at'>;

// ── Plan 10: Provider and Model Strategy ─────────────────────────────────────

export interface ProviderCapabilities {
  single_speaker_tts: boolean;
  multi_speaker_tts: boolean;
  streaming: boolean;
  language_selection: boolean;
  voice_list: boolean;
  pcm_output: boolean;
}

export interface ProviderModel {
  id: string;
  display_name: string;
  is_default?: boolean;
  notes?: string;
}

export interface ProviderVoice {
  id: string;
  display_name: string;
}

export interface ProviderInfo {
  id: string;
  display_name: string;
  capabilities: ProviderCapabilities;
  models: ProviderModel[];
  voices: ProviderVoice[];
  default_model: string;
  key_provider: string;
  key_configured: boolean;
}

// ── Plan 11: Deliverable Packaging ───────────────────────────────────────────

export interface ExportJob {
  id: number;
  project_id: number;
  export_profile_id?: number;
  status: 'pending' | 'running' | 'complete' | 'failed';
  output_path?: string;
  error?: string;
  metadata_json?: string;
  created_at: string;
  updated_at: string;
}

// -- AI Script Prep (Plan 12) -----------------------------------------------

export interface ScriptPrepSegment {
  script_text: string;
  speaker_label?: string;
  confidence?: number;
}

export interface ScriptPrepSection {
  title: string;
  kind: string;
  segments: ScriptPrepSegment[];
}

export interface ScriptPrepSpeakerCandidate {
  label: string;
  occurrences: number;
  sample_lines: string[];
}

export interface ScriptPrepPronunciationCandidate {
  word: string;
  phonetic?: string;
  notes?: string;
}

export interface ScriptPrepResult {
  sections: ScriptPrepSection[];
  speaker_candidates: ScriptPrepSpeakerCandidate[];
  pronunciation_candidates: ScriptPrepPronunciationCandidate[];
  style_suggestions: string[];
  warnings: string[];
}

export interface ScriptPrepOptions {
  project_kind?: string;
  detect_speakers?: boolean;
  suggest_pronunciations?: boolean;
  suggest_styles?: boolean;
  max_segment_length?: number;
}

export interface ScriptPrepJob {
  id: number;
  project_id: number;
  raw_script_hash: string;
  raw_script: string;
  result_json?: string;
  status: 'pending' | 'processing' | 'complete' | 'failed';
  error?: string;
  created_at: string;
  updated_at: string;
}

export interface ScriptPrepApplyInput {
  job_id?: number;
  result?: ScriptPrepResult;
  create_cast_profiles?: boolean;
  create_pronunciation_entries?: boolean;
}

export interface ScriptPrepApplyResult {
  sections_created: number;
  segments_created: number;
  cast_profiles_created: number;
  pronunciation_entries_created: number;
}
