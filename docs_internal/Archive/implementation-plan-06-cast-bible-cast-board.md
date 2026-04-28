# Implementation Plan: Cast Bible and Cast Board

## Related Enhancement

Cast Bible for Characters and Narrator Continuity.

Merged UI/UX item:
- Voice and cast board.

## Current Foundations

- Custom presets store voice, system instruction, sample text, source query, tags, color, generated headshot metadata, and version history.
- Voice comparison and AI Casting Director can audition voice options.
- Multi-speaker dialogue already maps speaker labels to voice names.

## Target Outcome

Creators can maintain a project or series cast bible with narrator and character profiles, assigned voices, pronunciation notes, sample lines, continuity warnings, and quick auditions.

## Phase 1: Data Model

Add migrations:

- `cast_profiles`
  - `id`
  - `project_id`
  - `series_id`
  - `name`
  - `role` (`narrator`, `protagonist`, `antagonist`, `supporting`, `extra`, `brand_voice`, `archived`)
  - `description`
  - `voice_name`
  - `preset_id`
  - `style_id`
  - `accent_id`
  - `language_code`
  - `age_impression`
  - `emotional_range`
  - `sample_lines_json`
  - `pronunciation_notes`
  - `metadata_json`
  - `sort_order`
  - timestamps

- `cast_profile_versions`
  - snapshot key fields before edits, similar to `preset_versions`.

Optional later:

- `series` table for cross-project cast reuse.

## Phase 2: Backend APIs

Routes:

- `GET /api/projects/{id}/cast`
- `POST /api/projects/{id}/cast`
- `GET /api/cast/{profileId}`
- `PUT /api/cast/{profileId}`
- `DELETE /api/cast/{profileId}`
- `GET /api/cast/{profileId}/versions`
- `POST /api/cast/{profileId}/versions/{versionId}/revert`
- `POST /api/cast/{profileId}/audition`

Audition payload:

- `sample_text`
- optional `voice_name`
- optional `preset_id`
- optional `style_id`

Audition returns regular TTS audio and can optionally create a take-like audition record later.

## Phase 3: Cast Board UI

Add components:

- `CastBoard.tsx`
- `CastProfileCard.tsx`
- `CastProfileEditor.tsx`
- `CastAuditionPanel.tsx`
- `CastContinuityWarnings.tsx`

Board grouping:

- Narrator
- Main cast
- Supporting cast
- Extras
- Brand voices
- Archived

Card actions:

- Play sample line.
- Audition alternate voice.
- Edit profile.
- Assign to selected segment speaker.
- Open source preset.

## Phase 4: Project Workspace Integration

Segment inspector:

- Speaker field can pick from cast profiles.
- Voice settings can inherit from cast profile.
- Changing a cast voice updates inherited segments unless explicitly overridden.

Dialogue mode:

- Speaker labels can map to cast profiles rather than raw voice names.

Warnings:

- Character appears in segment but has no cast profile.
- Segment uses a different voice than assigned cast profile.
- Two major characters use the same voice and style.
- Cast profile was changed after approved takes were rendered.

## Phase 5: Series-Level Reuse

Add series support after project-level cast is stable:

- Create cast profile in series.
- Link project to series.
- Pull cast into new project.
- Override per project when needed.

## Technical Risks

- Presets and cast profiles overlap. Keep the distinction clear: presets describe reusable voice/persona settings, cast profiles describe a role in a project or series.
- Voice similarity warnings should start rule-based, not AI-dependent.
- Updating inherited settings can accidentally dirty many segments. Require confirmation for bulk propagation.

## Testing Plan

Backend:

- Cast CRUD tests.
- Version snapshot and revert tests.
- Inheritance resolution tests once linked to segments.

Frontend:

- TypeScript build.
- Cast board grouping and warning display tests where practical.
- Playwright flow: create character, assign voice, assign to segment, change profile, see continuity warning.

## Exit Criteria

- A fiction or audiobook project can maintain persistent narrator and character voice assignments, audition them, and detect continuity drift before rendering.

