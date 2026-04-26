# Implementation Plan: Performance Style Presets

## Related Enhancement

Performance Style Presets.

## Current Foundations

- AI Casting Director returns structured system instructions with Audio Profile, Scene, Director's Notes, Sample Context, and Transcript.
- Script templates already include delivery guidance.
- Audio tags provide inline performance hints.
- Custom presets store system instructions but mix persona and performance style together.

## Target Outcome

Separate "who is speaking" from "how they perform." Creators can apply reusable performance styles to voices, characters, segments, chapters, or whole projects.

## Phase 1: Style Data Model

Add migrations:

- `performance_styles`
  - `id`
  - `scope` (`global`, `project`, `client`)
  - `project_id`
  - `client_id`
  - `name`
  - `description`
  - `category` (`narration`, `commercial`, `education`, `character`, `wellness`, `documentary`, `trailer`, `custom`)
  - `pacing`
  - `energy`
  - `emotion`
  - `articulation`
  - `pause_density`
  - `director_notes`
  - `audio_tags_json`
  - `metadata_json`
  - timestamps

- `performance_style_versions`
  - snapshot on edit.

Seed initial styles:

- Calm narration
- Suspense
- Intimate whisper
- Energetic ad read
- Friendly explainer
- Documentary
- Trailer
- Bedtime story

## Phase 2: Prompt Composition

Add a prompt composition utility:

- `backend/internal/promptbuilder`

Inputs:

- voice/custom preset persona
- cast profile
- performance style
- accent instruction
- pronunciation-transformed transcript
- segment notes

Output:

- final TTS text payload with consistent section order.

Rules:

- Persona and performance style should not overwrite the transcript.
- Style notes should merge with accent notes.
- Audio tags remain in transcript.
- Store composed prompt hash in render metadata.

## Phase 3: APIs

Routes:

- `GET /api/styles`
- `POST /api/styles`
- `GET /api/styles/{id}`
- `PUT /api/styles/{id}`
- `DELETE /api/styles/{id}`
- `GET /api/styles/{id}/versions`
- `POST /api/styles/{id}/versions/{versionId}/revert`
- `POST /api/styles/from-render`

`from-render` creates a reusable style from a successful take's settings and notes.

## Phase 4: Frontend UI

Add components:

- `StylePresetPicker.tsx`
- `StylePresetEditor.tsx`
- `StylePresetCard.tsx`
- `StylePreviewPanel.tsx`

Workspace integration:

- Project default style.
- Section style override.
- Segment style override.
- Cast profile default style.
- "Save as style" from a take.

Controls should be compact:

- Category select.
- Sliders or segmented controls for pacing, energy, pause density.
- Textarea for director notes.
- Audio tag suggestions.

## Phase 5: Style Comparison

Add A/B rendering:

- Same segment, same voice, two styles.
- Save preferred style setting back to segment/project.

This can reuse VoiceCompare patterns but compare styles instead of voices.

## Technical Risks

- Prompt composition can become hard to reason about. Keep a preview of the final prompt available in advanced mode.
- Style presets can conflict with voice persona or accent notes. Define deterministic merge order.
- Too many style controls can overwhelm users. Keep detailed controls inside an advanced panel.

## Testing Plan

Backend:

- Style CRUD and version tests.
- Prompt builder tests for merge order and transcript preservation.

Frontend:

- TypeScript build.
- Style picker and override display tests.
- Playwright flow: create style, apply to segment, render, save take, create style from render.

## Exit Criteria

- A user can reuse a performance style independently from the selected voice or cast profile, and renders record which style was used.

