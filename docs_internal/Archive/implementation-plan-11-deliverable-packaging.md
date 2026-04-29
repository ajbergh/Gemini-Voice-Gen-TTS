# Implementation Plan: Deliverable Packaging

## Related Enhancement

Deliverable Packaging.

## Current Foundations

- History export supports JSON and CSV.
- Preset export/import exists.
- Backup/restore exists.
- The app can create WAV downloads in the browser.
- Audio finishing will provide stitched approved audio.

## Target Outcome

Creators can export deliverables that match real client, editor, or publishing workflows: approved WAVs, project metadata, pronunciation dictionary, cast bible, notes, and predictable file names.

## Phase 1: Export Profiles

If not already added by audio finishing, create `export_profiles`:

- `id`
- `scope` (`global`, `project`, `client`)
- `project_id`
- `client_id`
- `name`
- `target` (`audiobook_chapters`, `voiceover_variants`, `editor_handoff`, `archive`, `raw_takes`)
- `filename_template`
- `include_audio`
- `include_project_json`
- `include_cast_bible`
- `include_pronunciation_dictionary`
- `include_qc_notes`
- `include_render_metadata`
- `audio_format` (`wav` initially)
- `metadata_json`
- timestamps

Filename template examples:

- `{project}-{chapter}-{take}`
- `{client}-{campaign}-{variant}`
- `{project}-{section}-{segment}-{voice}`

## Phase 2: Export Job Model

Add migrations:

- `export_jobs`
  - `id`
  - `project_id`
  - `client_id`
  - `export_profile_id`
  - `status`
  - `output_path`
  - `error`
  - `metadata_json`
  - timestamps

- `export_job_items`
  - `id`
  - `export_job_id`
  - `asset_type`
  - `asset_id`
  - `output_name`
  - `status`
  - `error`

Use the job center for progress.

## Phase 3: Backend Packaging

Add package:

- `backend/internal/exporter`

Responsibilities:

- Resolve approved takes.
- Apply filename templates.
- Generate metadata files.
- Build ZIP archive.
- Use safe output paths under an export cache directory.

Routes:

- `GET /api/export-profiles`
- `POST /api/export-profiles`
- `PUT /api/export-profiles/{id}`
- `DELETE /api/export-profiles/{id}`
- `POST /api/projects/{id}/exports`
- `GET /api/exports/{exportId}`
- `GET /api/exports/{exportId}/download`

Initial package contents:

- `audio/*.wav`
- `project.json`
- `cast-bible.json`
- `pronunciation-dictionary.json`
- `qc-notes.csv`
- `render-metadata.json`
- `README.txt`

## Phase 4: Frontend Export Flow

Add components:

- `ExportDialog.tsx`
- `ExportProfileEditor.tsx`
- `ExportPreviewTable.tsx`
- `ExportJobStatus.tsx`

Workflow:

1. Select export scope: project, chapter, selected segments, campaign variants.
2. Select profile.
3. Preview files and missing requirements.
4. Start export job.
5. Download when complete.

Validation:

- No approved take for selected segment.
- Open QC issues.
- Changed script after approval.
- Missing pronunciation dictionary export if profile requires it.

## Phase 5: Later Audio Formats

Do not block v1 on MP3/M4B.

Later options:

- Optional external encoder detection.
- Browser encoder dependency.
- Pure Go encoder if quality and licensing are acceptable.

If added, show explicit export capability status in Settings.

## Technical Risks

- ZIP files can grow large. Stream output where possible and clean old exports.
- Filename templates need sanitization to prevent invalid paths.
- Export profiles can overlap with backup. Keep backup as full app data, export as creator deliverable.

## Testing Plan

Backend:

- Filename template tests.
- ZIP manifest tests.
- Safe path tests.
- Export job status tests.

Frontend:

- Export preview validation tests.
- Playwright flow: select approved takes, export WAV ZIP, download endpoint returns archive.

## Exit Criteria

- A creator can package approved project audio and supporting metadata into a predictable ZIP without relying on manual downloads from individual preview controls.

