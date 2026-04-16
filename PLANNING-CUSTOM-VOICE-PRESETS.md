# Custom Voice Presets — Enhancement Plan

## Overview

Allow users to **save AI-recommended voices as custom presets** with cached sample audio. The voice browser gains a tab switcher: **Stock Voices** (the existing 30 Gemini voices) and **My Voices** (user-created presets from AI Casting Director / AI Suggested Persona results).

---

## Status

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: DB migration + store | **Complete** | `002_create_custom_presets.sql`, `store/presets.go` |
| Phase 2: Backend API endpoints | **Complete** | `handler/api_presets.go`, routes + server wiring |
| Phase 3: Frontend API client | **Complete** | `types.ts` + `api.ts` updated with 6 preset functions |
| Phase 4: Tab UI + PresetGrid/Card | **Complete** | `PresetGrid.tsx`, `PresetCard.tsx`, FilterBar tab switcher, App.tsx state |
| Phase 5: Save as Preset flow | **Complete** | "Save Preset" button in AiTtsPreview, sourceQuery threaded from VoiceFinder |
| Phase 6: Playback, edit, delete | **Complete** | PresetCard playback, PresetEditModal, delete with confirmation |
| Phase 7: My Voices UI rework | **Complete** | PresetCard horizontal layout matching VoiceCard, PresetCarousel3D mirroring Carousel3D, carousel/grid toggle for My Voices tab |
| Phase 8: ScriptReader stock/custom toggle | **Complete** | Stock/My Voices toggle in ScriptReaderModal, custom preset selector dropdown, AiTtsPreview receives selected preset's base voice |

## Assumptions & Issues

1. **AiTtsPreview has a single voice selector dropdown** — the "Save as Preset" button belongs inside `AiTtsPreview`, not per-voice in `AiResultCard`. The component already tracks `selectedVoiceName` and `audioData` (base64) internally.
2. **Source query not available in AiResultCard** — `AiRecommendation` has `voiceNames`, `systemInstruction`, `sampleText` but NOT the original user query. We must thread the query through: either add it to the type or pass as a separate prop.
3. **Audio may not exist at save time** — user may save a preset before generating TTS. We follow Option A: save without audio, show "Generate Sample" in PresetCard later.
4. **Preset names must be unique** — enforced at the DB level to avoid confusion.

1. When the AI Casting Director returns a recommendation, the user can "Save as Preset" for any recommended voice.
2. Saved presets store: voice name, system instruction, sample text, generation settings, and cached audio.
3. A tab-based UI lets users switch between **Stock** and **Custom** voice views.
4. Custom voice presets play cached audio instantly (no re-generation needed).
5. Presets can be edited (rename, update sample text) and deleted.

---

## Current Architecture (Reference)

| Layer | Key Files | What Exists |
|-------|-----------|-------------|
| **Types** | `types.ts` | `Voice`, `VoiceAnalysis`, `AiRecommendation`, `FilterState` |
| **State** | `App.tsx` | `playingVoice`, `aiResult`, `filters`, `viewMode`, `activeIndex` |
| **API** | `api.ts` | `recommendVoices()`, `generateTts()`, history CRUD, config CRUD |
| **Backend Store** | `store/` | `history`, `config`, `api_keys`, `voices` tables |
| **Audio Cache** | `handler/api_voices.go` | TTS audio saved to `AudioCacheDir` as `.raw` PCM files |
| **Components** | `AiResultCard.tsx`, `AiTtsPreview.tsx` | Display AI results, play/download TTS audio |

---

## Phase 1: Database Schema — Custom Presets Table

### New Migration: `002_create_custom_presets.sql`

```sql
CREATE TABLE IF NOT EXISTS custom_presets (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT    NOT NULL,              -- User-chosen display name
    voice_name         TEXT    NOT NULL,              -- Gemini voice name (e.g. "Kore")
    system_instruction TEXT,                          -- AI system instruction from recommendation
    sample_text        TEXT,                          -- Sample text used for TTS generation
    audio_path         TEXT,                          -- Path to cached .raw PCM audio file
    source_query       TEXT,                          -- Original AI casting query that created this
    metadata_json      TEXT,                          -- Extensible JSON (tags, color, notes, etc.)
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_custom_presets_voice ON custom_presets(voice_name);
CREATE INDEX IF NOT EXISTS idx_custom_presets_name  ON custom_presets(name);
```

**Key decisions:**
- `voice_name` references the Gemini voice (Kore, Puck, etc.) but is NOT a foreign key — presets are standalone.
- `audio_path` points to the cached `.raw` PCM file in `AudioCacheDir`. When saving a preset, the audio from the TTS preview is persisted here.
- `metadata_json` is an extensible JSON blob for future features (tags, color labels, user notes).

### Files Changed
- `backend/internal/store/migrations/002_create_custom_presets.sql` — new file
- `backend/internal/store/presets.go` — new file: CRUD methods for the `custom_presets` table

### New Store Methods (`store/presets.go`)

```go
type CustomPreset struct {
    ID                int64   `json:"id"`
    Name              string  `json:"name"`
    VoiceName         string  `json:"voice_name"`
    SystemInstruction *string `json:"system_instruction,omitempty"`
    SampleText        *string `json:"sample_text,omitempty"`
    AudioPath         *string `json:"audio_path,omitempty"`
    SourceQuery       *string `json:"source_query,omitempty"`
    MetadataJSON      *string `json:"metadata_json,omitempty"`
    CreatedAt         string  `json:"created_at"`
    UpdatedAt         string  `json:"updated_at"`
}

func (s *Store) ListCustomPresets() ([]CustomPreset, error)
func (s *Store) GetCustomPreset(id int64) (*CustomPreset, error)
func (s *Store) InsertCustomPreset(preset CustomPreset) (int64, error)
func (s *Store) UpdateCustomPreset(id int64, preset CustomPreset) error
func (s *Store) DeleteCustomPreset(id int64) error
func (s *Store) GetPresetAudio(id int64) (string, error) // returns audio_path
```

---

## Phase 2: Backend API Endpoints

### New Handler: `handler/api_presets.go`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/presets` | List all custom presets (returns array, no audio data) |
| `GET` | `/api/presets/{id}` | Get a single preset by ID |
| `POST` | `/api/presets` | Create a new preset (accepts name, voice_name, system_instruction, sample_text, audio_base64, source_query, metadata) |
| `PUT` | `/api/presets/{id}` | Update preset (name, sample_text, metadata) |
| `DELETE` | `/api/presets/{id}` | Delete preset and its cached audio file |
| `GET` | `/api/presets/{id}/audio` | Retrieve cached audio as base64 PCM for playback |

**POST `/api/presets` request body:**
```json
{
  "name": "Irish Storyteller",
  "voice_name": "Kore",
  "system_instruction": "Speak with a warm Irish accent...",
  "sample_text": "Once upon a time...",
  "audio_base64": "<base64 PCM data>",
  "source_query": "A high pitch male with a strong Irish accent",
  "metadata": { "tags": ["irish", "storytelling"] }
}
```

**Audio handling on POST:**
1. Decode `audio_base64` from the request body.
2. Write to `AudioCacheDir/preset_{id}_{voice_name}.raw`.
3. Store the file path in `audio_path` column.

**Audio handling on DELETE:**
1. Read `audio_path` from the database row.
2. Delete the file from disk.
3. Delete the database row.

### Files Changed
- `backend/internal/handler/api_presets.go` — new file
- `backend/internal/server/routes.go` — register new preset routes
- `backend/internal/server/server.go` — wire `PresetsHandler` into server construction

### Route Registration (routes.go additions)
```go
// Presets
mux.HandleFunc("GET /api/presets", presetsH.ListPresets)
mux.HandleFunc("GET /api/presets/{id}", presetsH.GetPreset)
mux.HandleFunc("POST /api/presets", presetsH.CreatePreset)
mux.HandleFunc("PUT /api/presets/{id}", presetsH.UpdatePreset)
mux.HandleFunc("DELETE /api/presets/{id}", presetsH.DeletePreset)
mux.HandleFunc("GET /api/presets/{id}/audio", presetsH.GetPresetAudio)
```

---

## Phase 3: Frontend API Client

### New Functions in `api.ts`

```ts
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

export async function listPresets(): Promise<CustomPreset[]>
export async function getPreset(id: number): Promise<CustomPreset>
export async function createPreset(data: {
  name: string;
  voice_name: string;
  system_instruction?: string;
  sample_text?: string;
  audio_base64?: string;
  source_query?: string;
  metadata?: Record<string, any>;
}): Promise<{ id: number }>
export async function updatePreset(id: number, data: Partial<...>): Promise<void>
export async function deletePreset(id: number): Promise<void>
export async function getPresetAudio(id: number): Promise<string>
```

### Files Changed
- `api.ts` — add preset CRUD functions
- `types.ts` — add `CustomPreset` interface (or keep in api.ts since it mirrors backend)

---

## Phase 4: Frontend UI — Tab Switcher

### 4a. Voice Tab State in `App.tsx`

Add a new top-level state:
```ts
const [voiceTab, setVoiceTab] = useState<'stock' | 'custom'>('stock');
const [customPresets, setCustomPresets] = useState<CustomPreset[]>([]);
```

On mount, load custom presets:
```ts
useEffect(() => {
  listPresets().then(setCustomPresets).catch(() => {});
}, []);
```

### 4b. Tab Switcher in `FilterBar.tsx`

Add a segmented control / tab bar to `FilterBar`:

```
[ Stock Voices (30) ] [ My Voices (3) ]
```

- When **Stock** is active: show existing `VOICE_DATA` with all current filter/search/carousel/grid behavior.
- When **My Voices** is active: show custom presets in grid view (carousel optional for v1).
- Search/filter should work on custom presets too (filter by preset name, voice name).

**Props additions to FilterBar:**
```ts
voiceTab: 'stock' | 'custom';
onVoiceTabChange: (tab: 'stock' | 'custom') => void;
customPresetCount: number;
```

### 4c. Custom Preset Grid — New Component `PresetGrid.tsx`

Displays custom presets in a grid layout similar to `GridView.tsx`:

Each preset card shows:
- Preset name (user-chosen, editable)
- Underlying Gemini voice name + badge
- Source query / description
- Play button (uses cached audio via `getPresetAudio()`)
- AudioVisualizer overlay while playing
- Action buttons: **Use** (opens ScriptReaderModal pre-configured), **Edit**, **Delete**

### 4d. Preset Card — New Component `PresetCard.tsx`

Similar to `VoiceCard.tsx` but for custom presets:
- Shows the base voice's image (looked up from `VOICE_DATA` by `voice_name`)
- Overlay with preset name and "Custom" badge
- Play/pause cached audio
- Dropdown or icon buttons for edit/delete

### Files Changed (Phase 4)
- `App.tsx` — add `voiceTab`, `customPresets` state, load on mount, pass to FilterBar and main content
- `components/FilterBar.tsx` — add tab switcher UI
- `components/PresetGrid.tsx` — new file: grid layout for custom presets
- `components/PresetCard.tsx` — new file: individual preset card

---

## Phase 5: Save Preset Flow

### 5a. "Save as Preset" Button in `AiResultCard.tsx`

After the AI Casting Director returns results and the user previews TTS audio, add a **"Save as Preset"** button next to each voice's `AiTtsPreview`.

**Flow:**
1. User clicks "Save as Preset" on a recommended voice.
2. A small inline form or popover appears asking for a **preset name** (defaulting to something like "Irish Storyteller — Kore").
3. On confirm, the frontend calls `createPreset()` with:
   - `name`: user-entered name
   - `voice_name`: the Gemini voice name
   - `system_instruction`: from `aiResult.systemInstruction`
   - `sample_text`: from `aiResult.sampleText`
   - `audio_base64`: the already-generated TTS audio (if available from the preview)
   - `source_query`: the original user query
4. On success, the `customPresets` state in App.tsx is refreshed.
5. Show a success toast/notification.

### 5b. Re-generate Audio on Save (if not previewed)

If the user saves without having previewed the voice's TTS:
- Option A: Save without audio, show "Generate Sample" button in PresetCard later.
- Option B: Auto-generate TTS at save time (slower but ensures audio is always cached).
- **Recommendation: Option A** — don't block save on TTS generation. Let the user generate later from the preset card.

### Files Changed (Phase 5)
- `components/AiResultCard.tsx` — add "Save as Preset" button per voice
- `components/AiTtsPreview.tsx` — expose generated audio data upward (callback or ref) so AiResultCard can pass it to the save flow

---

## Phase 6: Preset Playback & Actions

### 6a. Play Cached Audio

In `PresetCard.tsx`, the play button:
1. Calls `getPresetAudio(preset.id)` to get base64 PCM.
2. Decodes and plays via Web Audio API (same pattern as `AiTtsPreview.tsx` and `HistoryPanel.tsx`).
3. Shows `AudioVisualizer` overlay during playback.

### 6b. "Use Voice" Action

Clicking "Use" on a preset card:
1. Opens `ScriptReaderModal` pre-configured with `voice_name` and optionally `system_instruction`.
2. The user can type custom text and generate TTS with the saved voice settings.

### 6c. Edit Preset

A simple edit modal or inline form:
- Edit preset `name`
- Edit `sample_text`
- Optionally regenerate audio with new text

### 6d. Delete Preset

Confirmation dialog → calls `deletePreset(id)` → refreshes list.

### Files Changed (Phase 6)
- `components/PresetCard.tsx` — playback, use, edit, delete actions
- `components/PresetGrid.tsx` — wire actions through
- `App.tsx` — handlers for preset CRUD that refresh state

---

## Implementation Order

| Step | Phase | Description | Effort |
|------|-------|-------------|--------|
| 1 | Phase 1 | Migration SQL + `store/presets.go` | Small |
| 2 | Phase 2 | `handler/api_presets.go` + route registration | Medium |
| 3 | Phase 3 | `api.ts` preset functions + types | Small |
| 4 | Phase 4a | `App.tsx` state: `voiceTab`, `customPresets` | Small |
| 5 | Phase 4b | `FilterBar.tsx` tab switcher | Small |
| 6 | Phase 4c-d | `PresetGrid.tsx` + `PresetCard.tsx` | Medium |
| 7 | Phase 5 | "Save as Preset" in `AiResultCard.tsx` | Medium |
| 8 | Phase 6 | Preset playback, use, edit, delete | Medium |
| 9 | — | Build script verification + testing | Small |

---

## UI Mockup (Text)

```
┌─────────────────────────────────────────────────────┐
│  🔍 Search...   Gender ▾   Pitch ▾   ☰/⊞   🌙  ⚙  │
│                                                     │
│  ┌─────────────────┐  ┌─────────────────┐           │
│  │  Stock Voices    │  │  My Voices (3)  │           │
│  │  (active/bold)   │  │                 │           │
│  └─────────────────┘  └─────────────────┘           │
│                                                     │
│  [When "My Voices" tab is active:]                  │
│                                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│  │ 🖼 Kore  │  │ 🖼 Puck  │  │ 🖼 Charon│          │
│  │          │  │          │  │          │          │
│  │ "Irish   │  │ "Warm    │  │ "Deep    │          │
│  │ Teller"  │  │ Narrator"│  │ Villain" │          │
│  │          │  │          │  │          │          │
│  │ ▶ Custom │  │ ▶ Custom │  │ ▶ Custom │          │
│  │ ✏️ 🗑️ 🎯 │  │ ✏️ 🗑️ 🎯 │  │ ✏️ 🗑️ 🎯 │          │
│  └──────────┘  └──────────┘  └──────────┘          │
│                                                     │
│  [When "Stock Voices" tab is active:]               │
│  (existing carousel or grid view — no change)       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Data Flow Diagram

```
AI Casting Director (VoiceFinder)
    │
    ▼
AiResultCard (shows recommendation + AiTtsPreview per voice)
    │
    │  [User clicks "Save as Preset"]
    ▼
POST /api/presets  ──►  store.InsertCustomPreset()
    │                        │
    │                        ▼
    │                   custom_presets table (SQLite)
    │                        │
    │                   AudioCacheDir/preset_{id}_{voice}.raw
    │
    ▼
App.tsx refreshes customPresets state
    │
    ▼
PresetGrid / PresetCard (displays saved presets)
    │
    │  [User clicks Play]
    ▼
GET /api/presets/{id}/audio  ──►  read cached .raw file  ──►  base64 to frontend
    │
    ▼
Web Audio API playback (24kHz, 16-bit, mono)
```

---

## Open Questions / Future Extensions

1. **Preset export/import** — JSON file with embedded audio for sharing presets between machines.
2. **Preset categories/tags** — the `metadata_json` field supports this; UI can be added later.
3. **Carousel view for custom presets** — initially grid-only; carousel support can be added if users request it.
4. **System instruction in ScriptReaderModal** — when using a preset, should the system instruction be sent to Gemini automatically? (Requires backend TTS endpoint to accept optional system instruction.)
5. **Audio regeneration** — if a preset has no cached audio (Option A from Phase 5b), the preset card needs a "Generate Sample" button.
