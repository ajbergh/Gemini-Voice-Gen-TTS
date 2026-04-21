# AI Casting Director Image Generation Plan

## Goal

Add a new capability to AI Casting Director that generates a square headshot image for a custom voice preset using Gemini image generation. The generated image should represent the person described by the AI Casting Director and be attached to the preset so it can be shown anywhere the preset is rendered.

The image prompt must always include:

- `1:1 size`
- the person description produced by AI Casting Director
- the fixed modifier:

```text
Professional portrait headshot, studio photography, 85mm lens, soft professional lighting, neutral gradient background, sharp focus on eyes, high-end commercial quality, clean skin textures
```

## Current State

The current flow already has the right foundations:

- [components/VoiceFinder.tsx](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/components/VoiceFinder.tsx) submits the user query to the backend AI Casting Director recommendation endpoint.
- [backend/internal/handler/api_voices.go](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/backend/internal/handler/api_voices.go) handles Gemini-backed recommendation and TTS requests.
- [backend/internal/gemini/client.go](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/backend/internal/gemini/client.go) is the existing Gemini integration point.
- [backend/internal/handler/api_presets.go](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/backend/internal/handler/api_presets.go), [backend/internal/store/presets.go](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/backend/internal/store/presets.go), [api.ts](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/api.ts), and [types.ts](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/types.ts) already support saving extensible preset data via `metadata_json`.

That means this feature can be added without changing the overall architecture: AI generation remains backend-proxied, and the preset record remains the durable source of truth.

## Accuracy Notes

Reviewing the live codebase surfaced a few implementation details that matter:

- The actual preset save action currently originates in the AI TTS preview rendered from the AI result modal, not directly from `VoiceFinder.tsx`.
- The existing preset update path also needs to persist `system_instruction`; otherwise preset edits and inline edits silently drop that field.
- For the create flow, generating and caching the headshot before insert can be cleaner than insert-then-update, as long as any orphaned cache files are cleaned up if preset creation fails.

These do not change the capability design, but they do affect the most accurate implementation path.

## Validation Status

Implemented now:

- AI Casting Director recommendations now include `personDescription` end to end.
- Gemini image generation is implemented in the backend client via `GenerateHeadshot(...)`.
- Preset creation supports `generate_headshot` and `person_description`.
- Headshot prompt composition is handled on the backend and includes the required fixed modifier.
- Generated headshots are cached on disk and referenced from `metadata_json`.
- `GET /api/presets/{id}/image` is implemented.
- Generated headshots render in preset grid cards, preset carousel cards, and the preset edit modal.
- Preset deletion removes cached headshot files.
- Preset export and import now strip cache-local headshot metadata so exported presets do not carry broken file references.

Not implemented yet:

- `POST /api/presets/{id}/image/regenerate`
- explicit image-generation progress state in the UI
- automated frontend tests for the save flow and artwork fallback behavior

## Product Behavior

### User experience

1. The user opens AI Casting Director and enters a natural-language description.
2. Gemini returns the recommended voice data as it does today.
3. The app also derives or requests a visual person description for the selected AI casting result.
4. When the user saves the result as a custom preset, the app generates a square headshot image for that preset.
5. The preset stores the generated image reference so the image appears in preset cards, edit views, and any preset detail surfaces.

### Recommended v1 behavior

- Trigger image generation when the user explicitly saves a preset from an AI Casting Director result.
- Do not generate headshots for every recommendation automatically in the search results view.
- If image generation fails, still save the preset and mark the image as unavailable or pending.
- Allow future regeneration without changing the core preset identity.

This keeps Gemini image cost and latency tied to a concrete save action rather than every exploratory query.

## Core Design Decisions

### 1. Store image metadata on the preset

Use `metadata_json` first rather than adding a dedicated database column in v1.

Recommended metadata shape:

```json
{
  "castingDirector": {
    "sourceQuery": "Warm, confident British female narrator for a luxury brand video",
    "personDescription": "Mid-30s British woman with refined features, confident posture, polished wardrobe styling"
  },
  "headshot": {
    "status": "ready",
    "prompt": "1:1 size. Mid-30s British woman with refined features, confident posture, polished wardrobe styling. Professional portrait headshot, studio photography, 85mm lens, soft professional lighting, neutral gradient background, sharp focus on eyes, high-end commercial quality, clean skin textures",
    "mimeType": "image/png",
    "path": "preset_image_1745200000000_luxury-narrator.png",
    "generatedAt": "2026-04-21T00:00:00Z",
    "aspectRatio": "1:1",
    "imageSize": "1K",
    "model": "gemini-3.1-flash-image-preview"
  }
}
```

Why this approach:

- The preset model already supports `metadata_json` end to end.
- It avoids a migration for the first iteration.
- It preserves room for prompt versioning, status, and regeneration metadata.

If the feature grows, the image fields can later be promoted into explicit columns.

### 2. Cache image bytes on disk, not in SQLite

Follow the same pattern used for preset audio.

- Generate the image on the backend.
- Decode the returned image bytes.
- Write the image into the existing cache area under a cache-local filename such as `preset_image_<timestamp>_<presetName>.png`.
- Store the cached file path in `metadata_json`.

Implementation note:

- The current code stores a relative cache filename, not an absolute path.
- Export/import intentionally strip headshot cache metadata because the image bytes are not embedded in exported preset JSON.

Why:

- Keeps the database small.
- Matches the current audio caching pattern.
- Makes deletion and regeneration operationally straightforward.

### 3. Keep prompt composition on the backend

The frontend may supply the person description, but the final image prompt assembly should happen server-side.

Why:

- Prevents prompt drift across clients.
- Centralizes the required fixed modifier.
- Makes prompt versioning and safety filtering easier.

## Prompt Strategy

### Required prompt template

```text
1:1 size. {person_description}. Professional portrait headshot, studio photography, 85mm lens, soft professional lighting, neutral gradient background, sharp focus on eyes, high-end commercial quality, clean skin textures
```

### Prompt builder rules

- Always prefix with `1:1 size.`
- Use the AI Casting Director person description, not the original freeform user query, when available.
- Append the fixed visual modifier exactly as specified.
- Strip extra whitespace and duplicate punctuation.

### Recommended source for `person_description`

The cleanest implementation is to extend the recommendation response with a dedicated visual field:

```ts
interface AiRecommendation {
  voiceNames: string[];
  systemInstruction: string;
  sampleText: string;
  sourceQuery?: string;
  personDescription?: string;
}
```

That requires:

- updating [backend/internal/gemini/types.go](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/backend/internal/gemini/types.go)
- updating the Gemini recommendation prompt/response parsing in [backend/internal/gemini/client.go](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/backend/internal/gemini/client.go)
- updating the response payload in [backend/internal/handler/api_voices.go](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/backend/internal/handler/api_voices.go)
- updating the frontend type in [types.ts](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/types.ts)

Fallback option if we want less coupling in v1:

- Build the image description directly from the user query plus selected voice metadata.

That is easier to ship, but it is weaker because it mixes casting intent with rendering instructions instead of using a dedicated visual description.

## Backend Implementation

### 1. Extend the Gemini client with image generation

Add a new method in [backend/internal/gemini/client.go](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/backend/internal/gemini/client.go):

```go
func (c *Client) GenerateHeadshot(prompt string, model string) ([]byte, string, error)
```

Suggested return values:

- raw image bytes
- mime type
- error

Responsibilities:

- call the Gemini image generation endpoint
- request image output only
- parse the returned inline image data
- validate that the response actually contains image bytes

### 2. Add preset image generation handling to the presets API

Best fit is to extend preset creation rather than creating a standalone image endpoint first.

Recommended `POST /api/presets` request addition:

```json
{
  "name": "Luxury Narrator",
  "voice_name": "Kore",
  "system_instruction": "...",
  "sample_text": "...",
  "source_query": "...",
  "metadata_json": "...",
  "generate_headshot": true,
  "person_description": "Mid-30s British woman with refined features, confident posture, polished wardrobe styling"
}
```

Recommended backend flow:

1. Validate the preset payload.
2. Construct the final image prompt on the backend when `generate_headshot` is true.
3. Call Gemini image generation.
4. Cache the image file to disk.
5. Merge the image metadata into `metadata_json`.
6. Insert the preset record.
7. If preset creation fails, remove any orphaned cached files.
8. Return the created preset ID. Headshot status is persisted in `metadata_json` and is available on subsequent preset reads.

An insert-then-update flow can also work, but it may create noisier preset-version history unless the internal update path is handled separately.

### 3. Add image retrieval and lifecycle support

Add one new route for serving preset images:

- `GET /api/presets/{id}/image`

Responsibilities:

- load the preset
- inspect `metadata_json`
- validate the cached file path
- return the image bytes with the correct content type

Also update preset deletion in [backend/internal/handler/api_presets.go](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/backend/internal/handler/api_presets.go) to remove the cached image file along with the cached audio file.

### 4. Optional regeneration endpoint

Likely useful shortly after launch:

- `POST /api/presets/{id}/image/regenerate`

This can be deferred until after the initial save-path implementation.

## Frontend Implementation

### 1. Extend AI recommendation typing

Update [types.ts](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/types.ts) so the AI Casting Director result can carry `personDescription`.

### 2. Extend preset create API

Update [api.ts](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/api.ts) so `createPreset(...)` can send:

- `generate_headshot?: boolean`
- `person_description?: string`

Add a helper for retrieving the preset image if needed:

```ts
export function getPresetImageUrl(id: number): string {
  return `/api/presets/${id}/image`;
}
```

### 3. Save flow changes

Wherever the preset is created from an AI Casting Director recommendation, include:

- `generate_headshot: true`
- `person_description: aiResult.personDescription`
- existing `source_query`

If `personDescription` is missing, either:

- block headshot generation and save the preset without an image, or
- fall back to a derived description from the query

The stricter option is preferable because it keeps image quality predictable.

### 4. Preset card rendering

Update [components/PresetCard.tsx](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/components/PresetCard.tsx) so it prefers the generated preset headshot instead of the stock voice artwork when present.

Recommended display priority:

1. preset-generated headshot
2. existing stock voice image
3. neutral placeholder

### 5. Edit and management UX

Current state:

- [components/PresetEditModal.tsx](c:/Users/adam.bergh/OneDrive%20-%20Veeam%20Software%20Corporation/Documents/git/ajbergh/Gemini-Voice-Gen-TTS/components/PresetEditModal.tsx) now shows the current generated headshot or stock fallback artwork.

Still deferred:

- `Regenerate headshot` action
- optional `Remove headshot` action

## API and Data Contract Changes

### Recommendation response

Add:

```json
{
  "personDescription": "Mid-30s British woman with refined features, confident posture, polished wardrobe styling"
}
```

### Preset creation request

Add:

```json
{
  "generate_headshot": true,
  "person_description": "Mid-30s British woman with refined features, confident posture, polished wardrobe styling"
}
```

### Preset metadata

Store:

```json
{
  "headshot": {
    "status": "ready|failed",
    "prompt": "...",
    "mimeType": "image/png",
    "path": "...",
    "error": "...optional...",
    "generatedAt": "...",
    "aspectRatio": "1:1",
    "imageSize": "1K",
    "model": "gemini-3.1-flash-image-preview"
  }
}
```

## Error Handling

### Failure modes to design for

- Gemini API key missing
- Gemini image generation model unavailable or rate limited
- invalid or empty image response
- cache write failure
- malformed `metadata_json`

### v1 behavior

- Preset creation should still succeed if headshot generation fails.
- Headshot failure should be recorded in `metadata_json` with `status: failed` and an error string safe for UI display.
- The UI should fall back to the stock voice image or placeholder.

This avoids coupling preset persistence to a secondary enhancement.

## Testing Plan

### Backend

Implemented coverage:

- unit tests for prompt builder logic
- unit tests for metadata merge behavior
- unit tests for export/import metadata sanitization of headshot cache references
- unit tests for image cache path validation
- Gemini client tests for parsing image responses

Still missing:

- handler tests for `POST /api/presets` with successful and failed headshot generation
- handler tests for `GET /api/presets/{id}/image`

### Frontend

Implemented:

- frontend types updated for `personDescription` and preset headshot metadata
- production build validation passes

Still missing:

- save flow test confirming `generate_headshot` and `person_description` are sent
- preset card rendering test confirming generated image is preferred over stock artwork
- graceful fallback test when image retrieval fails

### Manual validation

1. Run AI Casting Director and save a new preset.
2. Verify the preset is created even if image generation is disabled or fails.
3. Verify a successful preset shows a square portrait headshot.
4. Verify deleting the preset removes both cached audio and cached image.
5. Verify older presets without image metadata still render correctly.

## Implementation Phases

### Phase 1

- extend AI recommendation schema with `personDescription`
- add Gemini image generation client method
- extend preset creation to optionally generate and persist a cached headshot
- add preset image retrieval endpoint
- render generated headshots in preset cards

Status: implemented

### Phase 2

- add regenerate headshot action in preset management UI
- add progress state for image generation
- add richer metadata such as prompt version and model used

Status: partially implemented

- richer metadata is already stored with `aspectRatio`, `imageSize`, and `model`
- regenerate and explicit progress UI are still pending

### Phase 3

- evaluate moving headshot fields from `metadata_json` into explicit DB columns if querying or filtering becomes necessary

## Recommendation

The best implementation path is:

1. extend the AI Casting Director response with a dedicated `personDescription`
2. generate the headshot only when saving a custom preset
3. cache the image on disk
4. store headshot status and path inside `metadata_json`
5. serve the image through a new preset image endpoint

That keeps the feature aligned with the existing backend-proxy and cache architecture, minimizes schema churn, and gives a clean upgrade path if preset-specific imagery becomes a first-class concept later.