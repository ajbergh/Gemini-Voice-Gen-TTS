# Implementation Plan: Script Projects and Production Workspace

## Related Enhancement

Script Projects With Chapters, Scenes, and Segments.

Merged UI/UX items:
- Replace modal-first Script Reader with a production workspace.
- Segment-based editor with render status badges.
- Creator-focused empty states and templates.

## Current Foundations

- `components/ScriptReaderModal.tsx` already supports text entry, templates, drag/drop `.txt` and `.md`, audio tags, syntax highlighting, voice selection, accents, dialogue mode, compare mode, and AI formatting.
- `App.tsx` already has a persistent `script` section that renders the Script Reader inline.
- SQLite migrations and store patterns are established in `backend/internal/store`.
- API patterns are typed in `api.ts`, with Go handlers registered in `backend/internal/server/routes.go`.

## Target Outcome

Turn Script Reader into the primary creator workspace for audiobook and voiceover production. A user can create a project, split it into chapters/scenes/segments, assign voices and settings, save progress, resume later, and prepare segments for rendering.

## Phase 1: Data Model and API Foundation

Add migrations:

- `script_projects`
  - `id`
  - `title`
  - `kind` (`audiobook`, `voiceover`, `podcast`, `training`, `character_reel`, `other`)
  - `description`
  - `status` (`draft`, `active`, `archived`)
  - `default_voice_name`
  - `default_preset_id`
  - `default_style_id`
  - `default_accent_id`
  - `default_language_code`
  - `default_provider`
  - `default_model`
  - `metadata_json`
  - `created_at`
  - `updated_at`

- `script_sections`
  - `id`
  - `project_id`
  - `parent_id`
  - `kind` (`chapter`, `scene`, `folder`)
  - `title`
  - `sort_order`
  - `metadata_json`
  - timestamps

- `script_segments`
  - `id`
  - `project_id`
  - `section_id`
  - `title`
  - `script_text`
  - `speaker_label`
  - `voice_name`
  - `preset_id`
  - `style_id`
  - `accent_id`
  - `language_code`
  - `provider`
  - `model`
  - `status` (`draft`, `changed`, `queued`, `rendering`, `rendered`, `approved`, `flagged`, `locked`)
  - `content_hash`
  - `sort_order`
  - timestamps

Backend store methods:

- `ListProjects`
- `CreateProject`
- `GetProject`
- `UpdateProject`
- `ArchiveProject`
- `ListProjectSections`
- `CreateSection`
- `UpdateSection`
- `ReorderSections`
- `ListProjectSegments`
- `CreateSegment`
- `UpdateSegment`
- `SplitSegment`
- `MergeSegments`
- `ReorderSegments`
- `DeleteSegment`

Routes:

- `GET /api/projects`
- `POST /api/projects`
- `GET /api/projects/{id}`
- `PUT /api/projects/{id}`
- `DELETE /api/projects/{id}`
- `GET /api/projects/{id}/sections`
- `POST /api/projects/{id}/sections`
- `PUT /api/projects/{id}/sections/{sectionId}`
- `PATCH /api/projects/{id}/sections/reorder`
- `GET /api/projects/{id}/segments`
- `POST /api/projects/{id}/segments`
- `PUT /api/projects/{id}/segments/{segmentId}`
- `DELETE /api/projects/{id}/segments/{segmentId}`
- `PATCH /api/projects/{id}/segments/reorder`
- `POST /api/projects/{id}/segments/{segmentId}/split`
- `POST /api/projects/{id}/segments/merge`

Frontend API/types:

- Add `Project`, `ScriptSection`, `ScriptSegment`, `ProjectKind`, and `SegmentStatus` to `types.ts`.
- Add typed project functions to `api.ts`.

## Phase 2: Workspace Shell

Add components:

- `components/ProjectWorkspace.tsx`
- `components/ProjectExplorer.tsx`
- `components/SegmentEditor.tsx`
- `components/SegmentInspector.tsx`
- `components/ProjectTemplateDialog.tsx`
- `components/SegmentStatusBadge.tsx`

Update `NavigationSidebar.tsx`:

- Keep the existing Script section label initially.
- Route it to `ProjectWorkspace` rather than the current modal-shaped Script Reader UI.

Initial workspace layout:

- Left rail: project list, section tree, segment status counts.
- Center: editable segment list with script text, audio tags, and speaker labels.
- Right inspector: voice, preset, accent, language, model, notes, status, and lock controls.
- Bottom bar: active selection, save state, basic playback placeholder for future phases.

## Phase 3: Import, Templates, and Segmentation

Add project templates:

- Audiobook
- Fiction dialogue
- Commercial spot
- Explainer video
- Podcast intro
- Meditation
- Training module

Import behavior:

- Start with `.txt` and `.md`.
- Preserve headings as sections.
- Split paragraphs into draft segments.
- Keep an unsplit original text snapshot in `metadata_json` for recovery.

Draft recovery:

- Store `last_open_project_id` in backend config.
- Open the last project when the Script section loads.
- Keep local unsaved edit debounce as a short-lived safety net only.

## Phase 4: Segment Status, Locking, and Dirty Detection

Add `content_hash` calculation on save.

Rules:

- If a rendered or approved segment text changes, set status to `changed`.
- If a locked segment is edited, require explicit unlock first.
- If project defaults change, show which segments inherit defaults and which have overrides.

UI:

- Status badge in segment header.
- Filter by status.
- Count status totals in the project explorer.

## Phase 5: Compatibility and Migration From Existing Script Reader

Keep `ScriptReaderModal.tsx` available as a compact preview utility until the new workspace reaches parity.

Add migration path:

- "Create project from current Script Reader text."
- "Send AI Casting result sample to project."
- "Send history entry to new project."

## Technical Risks

- Segment editing can become expensive if every keystroke writes to SQLite. Use debounced saves and explicit section-level bulk updates.
- Splitting and merging segments must preserve sort order and take relationships once take management exists.
- Inline highlighter and textarea overlay may need replacement with a segment-aware editor to avoid fragile scroll sync.

## Testing Plan

Backend:

- Migration validation for new tables and indexes.
- Store CRUD tests for project, section, segment, reorder, split, merge, and dirty-state transitions.
- Handler tests for invalid IDs, missing project ownership, and empty script text.

Frontend:

- TypeScript build.
- Component tests where practical for project explorer and status badge behavior.
- Manual Playwright pass for create project, import text, edit segment, split segment, lock segment, and reload/resume.

## Exit Criteria

- A user can create an audiobook project, import text, split it into chapters/segments, assign voice settings, leave the app, return, and resume exactly where they left off.
- The old single-text Script Reader is no longer the only path for script work.

