# Implementation Plan: Take Management and Line-Level Re-Render

## Related Enhancement

Take Management and Line-Level Re-Render.

Merged UI/UX items:
- History becomes an asset library.
- Trust and reproducibility indicators.

## Current Foundations

- `history` records TTS inputs and cached audio path.
- `HistoryPanel.tsx` can list, filter, play, export, and delete history entries.
- `AiTtsPreview.tsx` generates and downloads WAV files.
- Custom presets already have version history, which is a useful pattern for take metadata.

## Target Outcome

Every render can be saved as a take attached to a segment. Creators can compare takes, approve one, re-render only selected text, reuse settings, and trace exactly what produced the approved audio.

## Phase 1: Normalize History Types and Add Render Metadata

Before adding takes, update types to handle existing backend behavior:

- Include `tts_multi` in frontend history types.
- Add history filters for `tts_multi`.
- Store provider/model/language fields on new render records rather than relying on `result_json`.

Migration:

- Add optional fields to `history`:
  - `provider`
  - `model`
  - `language_code`
  - `accent_id`
  - `settings_json`
  - `duration_seconds`
  - `content_hash`

## Phase 2: Take Data Model

Add migrations:

- `segment_takes`
  - `id`
  - `project_id`
  - `segment_id`
  - `history_id`
  - `take_number`
  - `label`
  - `status` (`candidate`, `selected`, `approved`, `rejected`, `flagged`)
  - `audio_path`
  - `script_text`
  - `rendered_text`
  - `text_range_start`
  - `text_range_end`
  - `voice_name`
  - `preset_id`
  - `style_id`
  - `accent_id`
  - `language_code`
  - `provider`
  - `model`
  - `dictionary_hash`
  - `settings_json`
  - `duration_seconds`
  - `notes`
  - timestamps

- `take_notes`
  - `id`
  - `take_id`
  - `issue_type`
  - `note`
  - `time_offset_seconds`
  - `resolved`
  - timestamps

Rules:

- Only one selected take per segment.
- Only one approved take per segment unless explicitly allowing alternates later.
- Approved take stores immutable render metadata.

## Phase 3: Rendering Flow Updates

Single segment render:

- Create a new `segment_takes` row.
- Link to history.
- Update segment status to `rendered`.

Line-level re-render:

- Allow selected text range inside a segment.
- Render only that range.
- Store take with range metadata.
- In v1, do not auto-splice audio. Present it as a replacement candidate.
- Later audio finishing can splice approved line take into segment/chapter audio.

Reuse settings:

- Add endpoint to duplicate take settings into segment settings.
- Add frontend action "Use these settings".

Routes:

- `GET /api/projects/{id}/segments/{segmentId}/takes`
- `POST /api/projects/{id}/segments/{segmentId}/takes/render`
- `POST /api/projects/{id}/segments/{segmentId}/takes/render-selection`
- `PUT /api/takes/{takeId}`
- `POST /api/takes/{takeId}/select`
- `POST /api/takes/{takeId}/approve`
- `POST /api/takes/{takeId}/reject`
- `GET /api/takes/{takeId}/audio`
- `POST /api/takes/{takeId}/notes`
- `PUT /api/take-notes/{noteId}`

## Phase 4: Frontend Take UI

Add components:

- `TakeList.tsx`
- `TakeCard.tsx`
- `TakeComparePanel.tsx`
- `TakeMetadataBadges.tsx`
- `LineRerenderToolbar.tsx`
- `TakeNotesPanel.tsx`

Project inspector:

- Show takes for selected segment.
- Play, compare, select, approve, reject, delete.
- Show provider/model/voice/accent/style/dictionary metadata.
- Warn when current segment settings differ from approved take settings.

History panel:

- Add actions:
  - Send to project
  - Save as take
  - Save as preset
  - Reuse settings
  - Export audio

## Phase 5: Asset Library Behavior

Expand `HistoryPanel.tsx` into an asset library mode:

- Filter by project, segment, status, provider, model, and voice.
- Display duration and small waveform preview when available.
- Show multi-speaker entries correctly.
- Link history rows to take rows where applicable.

## Technical Risks

- Line-level re-render can imply seamless audio replacement, but v1 should avoid promising automatic splicing.
- Storing rendered text and original text is necessary for reproducibility but can increase database size.
- Audio path safety rules from cache handling must be reused for take audio.

## Testing Plan

Backend:

- Take CRUD tests.
- Single selected/approved constraint tests.
- Audio retrieval path safety tests.
- Render metadata persistence tests.

Frontend:

- TypeScript build.
- Take reducer/component tests where feasible.
- Playwright flow: render segment, create second take, compare, approve, edit segment, see dirty warning.

## Exit Criteria

- A creator can generate multiple takes for a segment, approve one, see exact render metadata, and reuse or compare previous outputs without searching raw history manually.

