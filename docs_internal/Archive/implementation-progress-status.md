# Implementation Progress and Status

Last reviewed: 2026-04-25 (post-Plan 14 Phase 3, Plan 12 apply, and Plan 13 mobile pass).

---

## Plan Validation

The internal docs are mostly accurate about the current architecture: React/Vite frontend, Go backend, SQLite migrations, encrypted API key storage, cached audio, history, custom presets, and an existing WebSocket progress path.

Latest validation notes:
- Plans 01-04 match production code at the feature-inventory level, with known deferred scope still called out below.
- Plan 05 is hardened for the implemented foundation: migration `012_take_metadata.sql` is restart-safe, take/audio/note routes enforce nested project + segment + take ownership, backend renders populate audio analysis/format metadata, and selected-segment batch rendering serializes `segment_ids`.
- Plan 05 still has starter Phase 4/5 timeline/export flows rather than the full exit criteria: marker workflows, true timeline seek, export job metadata, async export routes, and MP3/M4B strategy remain deferred.
- Plan 06 Phase 1 and Phase 2 are complete: cast profile schema/versioning, store methods, backend routes, audition endpoint, frontend API/types, and focused tests are in place.
- Plan 06 Phase 3 (Cast Board UI) is complete.
- Plan 06 Phase 4 is complete: `cast_profile_id` on segments (migration 015 + addColumnIfMissing), backend voice resolution through cast profiles, cast-profile picker in the segment editor, version history UI in CastProfileEditor, and `CastContinuityWarnings` banner in CastBoard.
- Plans 07, 08, and 09 are complete. The previous recommended-next section was stale and still pointed at Plan 07/08.
- Plan 10 Phase 1/2 were already started, and this pass completed Phase 3 provider/model defaults, Phase 4 fallback/provider voice mappings, and Phase 5 render metadata badges. Phase 6 provider comparison remains deferred.
- Plan 12 was already partially implemented before this pass: Gemini structured prep, `script_prep_jobs`, prepare route, API client types, and `ScriptPrepDialog.tsx` existed but were not wired into the project workspace and lacked a safe apply route. This pass completed the apply path and workspace integration.
- Plan 13 now has the central responsive hook, phone workspace tabs, mobile jobs view, and sticky review transport. Remaining mobile work is narrower component polish: swipe/menu take actions, bottom-sheet segment inspector, and Playwright viewport smoke scripts.
- Plan 14 Phase 3 is complete: Settings now has Export, global Dicts, and QC tabs; default export profile is consumed by the export dialog; global pronunciation dictionaries feed render-time dictionary application; QC settings feed review defaults, clipping auto-flagging, QC export format, and approved-only packaging behavior.

The agreed implementation dependency order is:

1. Global job center and standardized progress event fields.
2. History type normalization for single-speaker and multi-speaker TTS.
3. Minimal script project and segment schema.
4. Segment render statuses, take storage, and line-level re-render.
5. Pronunciation dictionaries before render payload composition.
6. Batch rendering on top of projects, segments, takes, and the job center.
7. Audio finishing, cast bible, export packaging, review/QC, settings, and mobile refinements.

---

## Completed Slices

### Slice A — Global Job Center, Progress Events, and History Normalization
*(Corresponds to plan-02 Phase 1 and plan-04 Phase 1)*

- `ProgressEvent` struct in `backend/internal/handler/ws_progress.go` extended with `item_id`, `project_id`, `segment_id`, `completed_items`, `total_items`, `failed_items`, `error_code`.
- `ProgressHub.Broadcast` persists every event before broadcasting via `persistEvent`.
- Frontend `ProgressEvent` interface in `api.ts` reflects all new fields as optional.
- `components/JobProvider.tsx` — React context that hydrates from `GET /api/jobs` on mount, then merges live WebSocket events. Exports `useJobs`, `JobRecord`, `formatJobType`, `isJobActive`, `isJobComplete`, `isJobFailed`.
- `components/JobCenter.tsx` — Global job drawer (active, completed, failed tabs, dismiss, clear-finished).
- `JobProvider` and `JobCenter` wired in `index.tsx` and `App.tsx`.
- Progress events emitted for AI casting, multi-speaker TTS, script formatting, and streaming TTS paths in Go handlers.
- `HistoryPanel.tsx` now handles `tts_multi` type in filter tabs and audio playback detection.
- `HistoryEntry` type in `api.ts` models `tts`, `tts_multi`, and `recommendation` entries.

### Slice B — Persisted Jobs and `/api/jobs` Reconciliation
*(Corresponds to plan-02 Phase 1 persistence)*

- Migration `008_create_jobs.sql`: `jobs` and `job_items` tables with full field set, foreign keys, and indexes.
- `backend/internal/store/jobs.go`: `Job`, `JobItem`, `JobProgressUpdate` types; `UpsertJobProgress`, `ListJobs`, `GetJob` store methods.
- `backend/internal/handler/api_jobs.go`: `GET /api/jobs` (with `limit` param) and `GET /api/jobs/{id}` handlers.
- `backend/internal/store/jobs_test.go`: coverage for upsert, list, and get.
- `JobProvider` startup reconciliation reads persisted jobs and merges them with any arriving WebSocket events so in-flight jobs survive page refresh.

### Slice C — Script Projects Schema, Backend CRUD, and ProjectWorkspace Shell
*(Corresponds to plan-01 Phase 1 + lightweight Phase 2 shell)*

- Migration `009_create_script_projects.sql`: `script_projects`, `script_sections`, `script_segments` tables with full field sets, foreign keys, and indexes.
- `backend/internal/store/projects.go`: `ScriptProject`, `ScriptSection`, `ScriptSegment` types; full CRUD store methods — `ListProjects`, `CreateProject`, `GetProject`, `UpdateProject`, `ArchiveProject`, `ListProjectSections`, `CreateSection`, `UpdateSection`, `DeleteSection`, `ListProjectSegments`, `CreateSegment`, `UpdateSegment`, `DeleteSegment`.
- `backend/internal/handler/api_projects.go`: all CRUD HTTP handlers registered under `/api/projects`.
- `backend/internal/store/projects_test.go`: project, section, segment, archive, and dirty-status coverage.
- `types.ts`: `ScriptProject`, `ScriptSection`, `ScriptSegment`, `ProjectKind`, `ProjectStatus`, `ScriptSectionKind`, `SegmentStatus`, and all input/update type aliases.
- `api.ts`: `listProjects`, `createProject`, `getProject`, `updateProject`, `archiveProject`, `listProjectSections`, `createProjectSection`, `updateProjectSection`, `deleteProjectSection`, `listProjectSegments`, `createProjectSegment`, `updateProjectSegment`, `deleteProjectSegment`.
- `components/ProjectWorkspace.tsx`: project listing, creation form (title + kind), selection, section/segment count display, segment previews, refresh, archive, and embedded `ScriptReaderModal` as a compact companion tool.

### Slice D — Plan 05 Hardening and Cast Backend Foundation
*(Corresponds to Plan 05 correctness hardening + plan-06 Phase 1/2)*

- `012_take_metadata.sql` converted to a no-op migration with all take metadata columns added idempotently via `addColumnIfMissing`.
- `segment_takes` now stores `sample_rate`, `channels`, and `format` alongside duration, peak, RMS, and clipping metadata.
- Backend render path analyzes 24 kHz 16-bit mono PCM via `backend/internal/audio` and stores duration, peak dBFS, RMS dBFS, clipping, sample rate, channel count, format, resolved voice, provider, model, and language metadata on created takes.
- Nested take/audio/note routes now validate project + segment + take ownership before returning, deleting, or attaching notes/audio.
- `batchRenderProject()` maps frontend `segmentIds` to backend `segment_ids`, with backend compatibility for the old camelCase payload.
- Migration `014_cast_profiles.sql`: `cast_profiles` and `cast_profile_versions`.
- `backend/internal/store/cast.go`: cast profile CRUD, version snapshot, version list, and revert methods.
- `backend/internal/handler/api_cast.go`: `GET/POST /api/projects/{id}/cast`, `GET/PUT/DELETE /api/cast/{profileId}`, version routes, and audition route.
- `types.ts` and `api.ts`: cast profile/version/audition types and typed API client functions.
- Focused tests added for audio analysis, take metadata/scoping, cast store versioning, and cast handler CRUD/version routes.

---

## Per-Plan Status Detail

### Plan 00 — Accuracy Review and Plan Map
**Status: Complete.** All 14 plan files exist. Plan map and merge map are accurate to the current codebase.

---

### Plan 01 — Script Projects and Production Workspace
**Status: Phase 1 complete. Phase 2 complete. Remaining work is segment/section reorder and mobile.**

Done:
- All three tables and their indexes (migration 009).
- Full backend CRUD store + handler + tests.
- Frontend types and API client.
- `ProjectWorkspace` shell: project list, create, select, counts, archive.
- Embedded `ScriptReaderModal` accessible from the workspace.
- `POST /api/projects/{id}/import` — parses `.txt`/`.md` into sections (headings) and segments (paragraphs). Go-level unit tests for `splitParagraphs` helper.
- `importProjectText()` in `api.ts`.
- Inline section creation form (title input + save/cancel).
- Inline section title editing (click pencil → inline input with kind selector → Enter/✓).
- Section `kind` dropdown (chapter / scene / folder) shown in the rename flow.
- Section delete button.
- Expand/collapse sections with chevron (all sections auto-expanded on load).
- Inline add-segment form per section and for unsectioned segments.
- Inline segment text editor (click pencil → textarea + speaker label + voice override → save/cancel).
- Speaker label field per segment (saved to `speaker_label`, shown as badge on segment row).
- Per-segment voice name override dropdown (saved to `voice_name`, shown as accent-colored badge).
- Segment delete button.
- Color-coded segment status badges (draft/changed/queued/rendering/rendered/approved/flagged/locked).
- `last_open_project_id` config key: persisted via `PUT /api/config` on project select; restored on Script section mount via `GET /api/config`.
- Import panel with textarea paste and file picker (.txt/.md).
- Project settings panel: collapsible panel for default voice (dropdown), language code, provider, model — saves via `PUT /api/projects/{id}`.
- `backend/internal/handler/api_projects_test.go` — `TestSplitParagraphs` with 9 cases.

Not yet done (remaining Phase 3):
- Section sort order drag-to-reorder.
- Segment reorder within a section.
- Responsive/mobile workspace layout (requires plan-13 groundwork).

---

### Plan 02 — Batch Rendering and Global Job Center
**Status: Phase 1 persistence complete. Phase 2 (queue execution) complete for the current sequential v1. Phase 3 (real-time segment status) complete.**

Done:
- Progress event schema extended (Slice A).
- `jobs` + `job_items` tables (Slice B).
- `GET /api/jobs`, `GET /api/jobs/{id}` (Slice B).
- Frontend `JobProvider` + `JobCenter` UI (Slice A).
- `store/projects.go`: `UpdateSegmentStatus(projectID, segmentID, status)` method.
- `handler/api_batch.go`: `BatchHandler` with `BatchRenderProject` (POST) and `CancelJob` (PATCH) handlers. Sequential TTS rendering with context cancellation, PCM audio caching, SegmentTake creation, and segment status updates.
- `server/routes.go` + `server/server.go`: `POST /api/projects/{id}/batch-render` and `PATCH /api/jobs/{id}/cancel` routes.
- `api.ts`: `batchRenderProject(projectId, options?)`, `cancelJob(jobId)`, `BatchRenderOptions`, `BatchRenderResponse`.
- `components/ProjectWorkspace.tsx`: "Render all" button in project header — calls `batchRenderProject`, shows toast with job ID.
- `components/JobCenter.tsx`: Cancel button on active `batch_render` jobs — calls `cancelJob`, hides when job is not cancellable.
- `components/JobProvider.tsx`: Added `subscribeToProgress(cb) → unsubscribe` to `JobContextValue` — forwards every raw `ProgressEvent` to registered callbacks without opening a second WebSocket.
- `components/ProjectWorkspace.tsx`: Subscribes to `subscribeToProgress` for the active project; batch_render events with `segment_id` immediately update the matching segment status to `"rendering"` in local state; batch_render finish events (complete/failed/cancelled) trigger a full `loadProjectContents` reload so final statuses are accurate.
- `api.ts`: `batchRenderProject()` now serializes selected segment scopes as `segment_ids`; backend also accepts the previous `segmentIds` shape for compatibility.

Not yet done:
- UI-level section/segment batch render controls.
- Worker concurrency (currently sequential, 1 segment at a time).
- Pause and retry job routes.

---

### Plan 03 — Pronunciation Dictionary and Replacement Rules
**Status: Complete.**

Done:
- Migration `011_pronunciation.sql`: `pronunciation_dictionaries` (project-scoped, CASCADE) and `pronunciation_entries` (dict-scoped, CASCADE) tables with indexes.
- `backend/internal/store/pronunciation.go`: `PronunciationDictionary`, `PronunciationEntry` types; 11 store methods: `ListDictionaries`, `CreateDictionary`, `GetDictionary`, `UpdateDictionary`, `DeleteDictionary`, `ListEntries`, `CreateEntry`, `GetEntry`, `UpdateEntry`, `DeleteEntry`, `ListEnabledEntriesForProject`.
- `backend/internal/store/pronunciation_test.go`: `TestPronunciationCRUD` covering full CRUD, ownership verification, `ListEnabledEntriesForProject` filtering, CASCADE delete.
- `backend/internal/pronunciation/apply.go`: `ApplyDictionary` (applies rules in order; plain-word uses `\b` word-boundary regex; is_regex entries use raw Go regexp; invalid patterns skipped silently; disabled entries skipped) and `Preview` (returns result + changed count).
- `backend/internal/pronunciation/apply_test.go`: 7 table-driven cases + `TestPreview`.
- `backend/internal/handler/api_pronunciation.go`: `PronunciationHandler` with 10 HTTP handlers; `requireProjectAndDict` ownership guard; `PreviewDictionary` endpoint.
- `backend/internal/server/routes.go` + `server.go`: 10 new routes under `/api/projects/{id}/dictionaries/...`
- `backend/internal/handler/api_batch.go`: `renderOneSegment` calls `ListEnabledEntriesForProject` then `pronunciation.ApplyDictionary` before every Gemini TTS call.
- `types.ts`: `PronunciationDictionary`, `PronunciationEntry`, `CreateEntryInput`, `PreviewResult` interfaces.
- `api.ts`: `listDictionaries`, `createDictionary`, `updateDictionary`, `deleteDictionary`, `listEntries`, `createEntry`, `updateEntry`, `deleteEntry`, `previewDictionary` client functions.
- `components/PronunciationEditor.tsx`: Two-panel component — left dict list (create/rename/delete); right entry table (add/inline-edit/delete, enabled toggle, regex badge); live preview section.
- `components/ProjectWorkspace.tsx`: "Dicts" toolbar button (BookOpen icon) toggling the `PronunciationEditor` panel inline, mutually exclusive with settings panel.
- Verified: `go test ./...` all pass; `npm run build` clean.

---

### Plan 04 — Take Management and Line-Level Re-Render
**Status: Phase 3 (segment re-render button) complete.**

Done:
- `tts_multi` history type handled in `HistoryPanel` filters and playback (Slice A).
- `HistoryEntry` type in `api.ts` models all three entry types.
- Migration `010_create_segment_takes.sql`: `segment_takes` and `take_notes` tables with FK cascade, indexes.
- `backend/internal/store/takes.go`: `SegmentTake`, `TakeNote` types; 7 store methods: `ListSegmentTakes`, `CreateTake` (auto-increments take_number, hashes script_text), `GetTake`, `DeleteTake`, `ListTakeNotes`, `CreateTakeNote`, `DeleteTakeNote`.
- `backend/internal/store/takes_test.go`: `TestSegmentTakeCRUD` covering create, list, notes, delete, not-found error.
- `backend/internal/handler/api_takes.go`: 7 HTTP handlers with `requireProjectAndSegment` helper.
- `backend/internal/server/routes.go` + `server.go`: 7 new takes routes registered.
- `types.ts`: `SegmentTake`, `TakeNote`, `CreateTakeInput` interfaces.
- `api.ts`: `listSegmentTakes`, `createSegmentTake`, `getSegmentTake`, `deleteSegmentTake`, `listTakeNotes`, `createTakeNote`, `deleteTakeNote`.
- `components/SegmentTakeList.tsx`: collapsible take list per segment — take rows with status badge, duration, timestamp; notes expand panel with add/delete; "Record take" form.
- `components/ProjectWorkspace.tsx`: imports and renders `SegmentTakeList` inside each non-editing segment row.
- `handler/api_batch.go`: `BatchHandler.RenderSegment` — `POST /api/projects/{id}/segments/{segmentId}/render` calls `renderOneSegment`, updates status, returns newest take.
- `server/routes.go`: `POST /api/projects/{id}/segments/{segmentId}/render` registered.
- `api.ts`: `reRenderSegment(projectId, segmentId)` client function.
- `components/ProjectWorkspace.tsx`: Re-render button (RefreshCw icon) per segment row, visible on hover, disabled during in-flight call, shows spinner. Only rendered when a voice is available (segment override or project default).

Not yet done:
- Optional history schema fields: `provider`, `model`, `language_code`, `accent_id`, `settings_json`, `duration_seconds`, `content_hash` (no migration added yet).
- A/B take comparison UI.
- Trust/reproducibility indicators on rendered audio.

---

### Plan 05 — Audio Finishing and Timeline Review
**Status: Phase 1 complete. Phase 2 complete for segment takes. Phase 3 complete. Starter Phase 4/5 timeline and WAV stitching are implemented, but the plan is not complete against its exit criteria. MP3/M4B strategy deferred.**

Done:
- Migration `012_take_metadata.sql`: restart-safe no-op migration; `peak_dbfs`, `rms_dbfs`, `clipping_detected`, `sample_rate`, `channels`, and `format` are added programmatically via `addColumnIfMissing`.
- Migration `013_export_profiles.sql`: `export_profiles` table with 5 builtin seed profiles (Audiobook, Podcast, Broadcast, Web Video VO, Raw).
- `backend/internal/store/takes.go`: `SegmentTake` struct extended with `PeakDbfs *float64`, `RmsDbfs *float64`, `ClippingDetected bool`, `SampleRate *int`, `Channels *int`, `Format *string`; all SQL queries (SELECT, INSERT) updated; `scanSegmentTake` updated. `GetBestTakeForSegment(projectID, segmentID)`, `GetTakeForSegment`, `DeleteTakeForSegment`, and `DeleteTakeNoteForTake` added.
- `backend/internal/store/export_profiles.go`: `ExportProfile` type; `ListExportProfiles`, `GetExportProfile`, `CreateExportProfile`, `UpdateExportProfile`, `DeleteExportProfile` store methods.
- `backend/internal/audio/analysis.go`: 24 kHz 16-bit PCM analysis utility for duration, peak dBFS, RMS dBFS, clipping, sample rate, channels, and format.
- `handler/api_batch.go`: `renderOneSegment` analyzes rendered PCM and stores duration, peak dBFS, RMS dBFS, clipping, sample rate, channels, format, resolved voice, provider, model, and language on the created `SegmentTake`.
- `handler/api_takes.go`: `AudioCacheDir string` added to `TakesHandler`; `GetTakeAudio` handler reads PCM cache file and returns base64-encoded bytes.
- `handler/api_takes.go`: nested take/audio/note routes now verify project + segment + take ownership before list/get/delete/audio/note operations.
- `handler/api_export_profiles.go`: `ExportProfilesHandler` with 5 CRUD HTTP handlers.
- `handler/api_stitch.go`: `StitchHandler{Store, AudioCacheDir}` with `StitchProject` (POST /api/projects/{id}/stitch). Reads best take per segment, optionally applies export profile (trim silence, normalize peak, leading/trailing/inter-segment silence), concatenates PCM, encodes RIFF/WAV, returns as `audio/wav` download. Includes helper functions `makePCMSilence`, `trimPCMSilence`, `normalizePCMPeak`, `encodePCMToWAV`.
- `server/routes.go` + `server/server.go`: `POST /api/projects/{id}/stitch`, `GET/POST /api/export-profiles`, `GET/PUT/DELETE /api/export-profiles/{id}`, `GET /api/projects/{id}/segments/{segmentId}/takes/{takeId}/audio` routes registered.
- `audio/pcm.ts`: `decodePcmBase64`, `pcmBytesToFloat32`, `calcDurationSeconds`, `decodePcmBase64ToFloat32` utilities.
- `audio/wav.ts`: `encodeWav` (extracted from `AiTtsPreview.tsx`), `createWavObjectUrl`.
- `audio/analysis.ts`: `AudioAnalysis` interface, `linearToDbfs`, `calcPeakDbfs`, `calcRmsDbfs`, `detectClipping`, `analyzeAudio` utilities.
- `audio/finishing.ts`: `trimSilence` (with `TrimOptions`), `normalizePeak`, `padSilence`, `concatAudio`, `applyFinishing` (full chain with `FinishingOptions`) utilities.
- `types.ts`: `SegmentTake` updated with `peak_dbfs?`, `rms_dbfs?`, `clipping_detected?`, `sample_rate?`, `channels?`, `format?`; `ExportProfile` interface added.
- `api.ts`: `getTakeAudio(projectId, segmentId, takeId)` client function; `listExportProfiles`, `getExportProfile`, `createExportProfile`, `updateExportProfile`, `deleteExportProfile` client functions; `ExportProfile` added to top-level import; `stitchProject(projectId, options)` — raw fetch returns `Blob` for WAV download; `StitchOptions` interface.
- `components/WaveformCanvas.tsx`: canvas-based bar waveform renderer with `Float32Array` input, Google color cycling, `ResizeObserver` for responsive width, DPR scaling, placeholder state. New props: `playbackPosition?: number` (draws vertical cursor at normalized position), `onSeek?: (position: number) => void` (click-to-seek affordance, pointer cursor).
- `components/ExportProfilePicker.tsx`: `<select>` dropdown that loads all export profiles from `/api/export-profiles`, groups builtins vs custom, calls `onChange(id, profile)`.
- `components/SegmentTakeList.tsx`: imports `WaveformCanvas` and `decodePcmBase64ToFloat32`; `waveforms` state tracks per-take `Float32Array | 'loading' | null`; audio fetched lazily; `AlertTriangle` clipping badge shown when `take.clipping_detected`; waveform canvas rendered in each take row.
- `components/TimelineReview.tsx`: per-segment timeline panel. Loads best take per segment via `listSegmentTakes` + `getTakeAudio`. Shows segment rows with collapse toggle, play/pause button, speaker badge, status badge, clipping warning, duration, waveform (WaveformCanvas with playback cursor), and script preview. Export toolbar: `ExportProfilePicker` + "Stitch & Export WAV" button that calls `stitchProject` and triggers browser download. Groups segments by section. Uses `useAudio()` for shared playback.
- `components/ProjectWorkspace.tsx`: `Film` icon added; `showTimeline` state added; "Timeline" toolbar button (mutually exclusive with Settings/Dicts panels); `<TimelineReview>` panel rendered when active.
- Verified: `go build -buildvcs=false ./...` clean, `go test ./...` all pass, `npm run build` clean. Plain `go build ./...` can fail in the sandbox due Git dubious-ownership/VCS stamping.

Not yet done:
- Add backend tests for export profile CRUD and stitching helpers.
- Add take-audio happy-path handler coverage.
- True click-to-seek (restart playback from clicked position — requires AudioProvider enhancement).
- A/B comparison UI for takes (Plan 04 remainder).
- Timeline note markers, flag markers, keyboard timeline controls, and long-project virtualization.
- Export job metadata and async export routes from Plan 05 Phase 5.
- MP3 / M4B export strategy (Plan 05 Phase 6, deferred).

---

### Plan 06 — Cast Bible and Cast Board
**Status: Phase 1 complete. Phase 2 complete. Phase 3 (Cast Board UI) complete. Phase 4 (segment picker, version history, continuity warnings) complete.**

Done:
- Migration `014_cast_profiles.sql`: `cast_profiles` and `cast_profile_versions` with project cascade, preset `SET NULL`, and indexes.
- `backend/internal/store/cast.go`: `CastProfile`, `CastProfileVersion`, CRUD, version snapshot, version list, and revert methods.
- `backend/internal/store/cast_test.go`: CRUD, snapshot, revert, and delete coverage.
- `backend/internal/handler/api_cast.go`: list/create project cast profiles, get/update/delete profile, list/revert versions, and audition endpoint.
- `backend/internal/handler/api_cast_test.go`: CRUD and version route coverage.
- `backend/internal/server/routes.go` + `server.go`: registered cast and audition routes.
- `types.ts`: cast role, profile, version, audition input/response types.
- `api.ts`: `listProjectCast`, `createCastProfile`, `getCastProfile`, `updateCastProfile`, `deleteCastProfile`, `listCastProfileVersions`, `revertCastProfileVersion`, `auditionCastProfile`.
- `components/CastProfileCard.tsx`: card showing name, role badge, voice badge, description, age impression, emotional range, first sample line; hover actions for edit/audition/delete.
- `components/CastProfileEditor.tsx`: create/edit modal with name, role, voice, description, age impression, emotional range, language code, sample lines (newline-separated textarea → JSON array), and pronunciation notes. Version history section (collapsible) with timestamp/role/voice per version and "Revert" button.
- `components/CastAuditionPanel.tsx`: audition modal pre-filled from sample_lines; voice override; calls `/api/cast/{profileId}/audition`; plays result via `useAudio().playPcm`.
- `components/CastBoard.tsx`: inline panel showing profiles grouped by role; per-group Add buttons; empty state; CRUD wiring to editor and audition modals; always shows Narrator and Protagonist groups for new projects. `CastContinuityWarnings` banner shown at top of body.
- `components/CastContinuityWarnings.tsx`: loads project segments and compares against cast profiles; flags speaker_label drift and cast_profile_id voice override mismatches; dismissible.
- Migration `015_segment_cast_profile.sql` (no-op) + `addColumnIfMissing(db, "script_segments", "cast_profile_id", "INTEGER")` in `store.go`.
- `backend/internal/store/projects.go`: `ScriptSegment.CastProfileID` field; all SELECT/INSERT/UPDATE SQL and `scanScriptSegment` updated.
- `backend/internal/handler/api_batch.go`: `renderOneSegment` resolves voice via cast profile first (cast profile → segment override → project default); also inherits cast profile `language_code`.
- `types.ts`: `cast_profile_id?: number` added to `ScriptSegment`.
- `components/ProjectWorkspace.tsx`: loads cast profiles on project select; segment editor shows grouped `<select>` (Cast Profiles / Individual Voices) with auto-fill of speaker label on profile pick; cast profile badge (violet) on segment rows; re-render button enabled when cast_profile_id is set.
- `components/ProjectWorkspace.tsx`: `CastProfile` imported from `types.ts`; `listProjectCast` imported from `api.ts`.

Not yet done:
- Optional `series` table for cross-project cast reuse.
- Segment speaker field → cast-profile cascade when profile voice_name is updated (currently requires re-opening the segment editor).

---

### Plan 07 — Performance Style Presets
**Status: Complete.**

Done:
- Migration `016_performance_styles.sql`: `performance_styles` and `performance_style_versions` tables with 8 built-in seed styles (Calm Narration, Suspense, Intimate Whisper, Energetic Ad Read, Friendly Explainer, Documentary, Trailer, Bedtime Story).
- `backend/internal/store/styles.go`: `PerformanceStyle`, `PerformanceStyleVersion` types; `ListStyles(projectID)`, `CreateStyle`, `GetStyle`, `UpdateStyle`, `DeleteStyle` (builtin-protected), `ListStyleVersions`, `RevertStyleVersion`, and private `snapshotStyle`. Used shared `boolToInt` from `pronunciation.go`.
- `backend/internal/store/styles_test.go`: 7-case `TestStyleCRUDAndVersions` covering seed count, create/get, update-creates-version, revert, delete user style, builtin protection, project-scoped visibility.
- `backend/internal/promptbuilder/promptbuilder.go`: `Input` struct with cast/preset/style/accent/segment fields; `Compose(in)` returns structured system instruction and SHA-256 hash. Section order: Character → Voice Character → Performance Style → Accent → Pronunciation Notes → Director's Note.
- `backend/internal/promptbuilder/promptbuilder_test.go`: 5 tests: empty, section order, transcript not modified, different hashes, segment-notes-only.
- `backend/internal/handler/api_styles.go`: `StylesHandler` with `ListStyles` (project_id query param), `CreateStyle`, `GetStyle`, `UpdateStyle`, `DeleteStyle` (400 for builtins), `ListStyleVersions`, `RevertStyleVersion`.
- `backend/internal/handler/api_styles_test.go`: 7-case `TestStylesHandlerCRUDAndVersions`.
- `backend/internal/server/server.go` + `routes.go`: `StylesHandler` registered; 7 new routes: `GET/POST /api/styles`, `GET/PUT/DELETE /api/styles/{id}`, `GET /api/styles/{id}/versions`, `POST /api/styles/{id}/versions/{versionId}/revert`.
- `backend/internal/handler/api_batch.go`: `renderOneSegment` resolves style via segment → cast profile → project default; builds `promptbuilder.Input` from cast profile + style fields; calls `promptbuilder.Compose()` for system instruction; passes instruction to `client.GenerateTTS`; stores `SystemInstruction` on `SegmentTake`.
- `types.ts`: `StyleCategory`, `PerformanceStyle`, `PerformanceStyleVersion`, `CreateStyleInput`, `UpdateStyleInput` added before ExportProfile section.
- `api.ts`: `CreateStyleInput`, `UpdateStyleInput`, `PerformanceStyle`, `PerformanceStyleVersion` imported; `listStyles`, `createStyle`, `getStyle`, `updateStyle`, `deleteStyle`, `listStyleVersions`, `revertStyleVersion` functions appended.
- `components/StylePresetCard.tsx`: card with name, category badge, builtin/project badges, descriptor chips (pacing/energy/emotion/articulation/pause_density), director's notes preview; edit/delete hover actions for non-builtins.
- `components/StylePresetEditor.tsx`: create/edit modal with name, description, category dropdown, 5 descriptor selects, director_notes textarea, and collapsible version history with revert.
- `components/StylePresetPicker.tsx`: compact grouped dropdown (Global styles / Project styles), "None" option, "Create new…" inline action, clear button, selected-style preview line.
- `components/ProjectWorkspace.tsx`: styles loaded alongside cast profiles on project open; `StylePresetPicker` in segment editor; `editingSegmentStyleId` state initialized on segment open; `style_id` passed to `updateProjectSegment`; `StylePresetPicker` in project settings for `default_style_id`; style badge (emerald) on segment rows; `settingsStyleId` initialized when settings panel opens.

---

### Plan 08 — Review, QC, and Approval Workflow
**Status: Complete.**

Done:
- `backend/internal/store/migrations/017_qc_issues.sql` — `qc_issues` table (segment/take FK, issue_type CHECK, severity CHECK, status CHECK, indexes).
- `backend/internal/store/qc.go` — `QcIssue`, `QcRollup`, `SegmentQcStatus` types; `ListProjectQcIssues`, `CreateQcIssue`, `GetQcIssue`, `UpdateQcIssue`, `ResolveQcIssue`, `DeleteQcIssue`, `GetProjectQcRollup`, `ListSegmentQcStatus`, `SetTakeStatus`.
- `backend/internal/store/qc_test.go` — 10-case integration test; all pass.
- `backend/internal/handler/api_qc.go` — `QcHandler` with 10 HTTP handlers incl. `ExportQcIssues` (CSV + Markdown) and `ApproveTake`/`FlagTake`.
- `backend/internal/handler/api_qc_test.go` — 7-case test; all pass.
- `backend/internal/server/routes.go` + `server.go` — 10 new routes registered (`/api/projects/{id}/qc*`, `/api/qc/{issueId}*`, approve/flag takes).
- `types.ts` — `QcIssueType`, `QcIssueSeverity`, `QcIssueStatus`, `QcIssue`, `QcRollup`, `SegmentQcStatus`, `CreateQcIssueInput`, `UpdateQcIssueInput`, `ReviewFilter`.
- `api.ts` — `listProjectQcIssues`, `createQcIssue`, `getQcIssue`, `updateQcIssue`, `deleteQcIssue`, `resolveQcIssue`, `getProjectQcRollup`, `exportQcIssues`, `approveTake`, `flagTake`.
- `components/QcIssueDialog.tsx` — modal for create/edit QC issues (focus trap, ARIA, dark mode).
- `components/QcIssueList.tsx` — per-segment issue list with resolve/edit/delete hover actions.
- `components/ReviewTransport.tsx` — keyboard-driven playback transport with approve/flag, hotkey hint strip.
- `components/ReviewQueue.tsx` — filterable segment list (all/unreviewed/flagged/open_issues) with status icons and QC count badges.
- `components/ReviewMode.tsx` — full-screen review panel combining queue + transport + QC issues; Space/A/F/R/N/P/M hotkeys (ApprovalHotkeys inline).
- `ProjectWorkspace.tsx` — "Review" toolbar button (`ClipboardCheck` icon) opens `ReviewMode`; mutually exclusive with other panels.
- Verified: `go test ./...` all pass; `npx tsc --noEmit` clean; `npm run build` succeeds.

---

### Plan 09 — Client and Brand Voiceover Workspaces
**Status: Complete.**

Done:
- `backend/internal/store/migrations/018_clients.sql` — `clients` + `client_assets` tables with FKs, indexes.
- `backend/internal/store/clients.go` — `Client` + `ClientAsset` types; `ListClients`, `GetClient`, `CreateClient`, `UpdateClient`, `DeleteClient`, `ListClientAssets`, `AddClientAsset` (INSERT OR IGNORE), `RemoveClientAsset`.
- `backend/internal/store/clients_test.go` — full CRUD + assets sub-test suite (all pass).
- `backend/internal/store/store.go` — `addColumnIfMissing` for `client_id` on `script_projects` and `pronunciation_dictionaries`.
- `backend/internal/handler/api_clients.go` — `ClientHandler` with 8 HTTP handlers.
- `backend/internal/handler/api_clients_test.go` — `TestClientHandlerCRUD` (all pass).
- `backend/internal/server/routes.go` + `server.go` — 8 client routes registered.
- `types.ts` — `Client`, `ClientAsset`, `CreateClientInput`, `UpdateClientInput`, `CreateClientAssetInput`.
- `api.ts` — `listClients`, `createClient`, `getClient`, `updateClient`, `deleteClient`, `listClientAssets`, `addClientAsset`, `removeClientAsset`.
- `components/ClientWorkspaceList.tsx` — responsive client list with select/edit/delete/new actions.
- `components/ClientProfileEditor.tsx` — create/edit modal with name, description, brand notes, default voice, advanced provider/model; focus trap, Escape-to-close, ARIA.
- Frontend build: ✅ TypeScript clean + Vite build passes.

Not yet done:
- Campaign/variant structure and segment templates (15s, 30s, 60s spot, etc.) — deferred.
- Wiring ClientWorkspaceList into NavigationSidebar (optional — components are ready to integrate).

---

### Plan 10 — Provider and Model Strategy
**Status: Phases 1-5 complete. Phase 6 deferred. OpenAI support removed 2026-04-25 (see `remove-openai-plan.md`).**

Done:
- `backend/internal/handler/api_providers.go` — `ProvidersHandler`, `ProviderInfo`, `ProviderCapabilities`, `ProviderModel`, `ProviderVoice` types; `GET /api/providers` handler returns Gemini-only registry with `key_configured` per provider.
- `backend/internal/handler/api_providers_test.go` — `TestProvidersHandlerListProviders` (asserts exactly 1 provider: gemini).
- `backend/internal/server/routes.go` + `server.go` — `GET /api/providers` registered; `ProvidersHandler` wired.
- `types.ts` — `ProviderCapabilities`, `ProviderModel`, `ProviderVoice`, `ProviderInfo` interfaces.
- `api.ts` — `listProviders()` function.
- Migration `019_provider_strategy.sql`: `provider_voice_mappings` table plus project-scoped and global uniqueness indexes (table inert; routes removed).
- `backend/internal/store/store.go`: idempotent fallback/provider metadata columns on projects, segments, clients, and segment takes; schema validation updated.
- `backend/internal/store/projects.go`, `clients.go`, and `takes.go`: provider/model fallback defaults and render reproducibility fields persisted.
- `backend/internal/handler/api_batch.go`: render provider/model resolution order is segment → project → client → global config → provider registry default. All values normalize to "gemini" (including legacy "openai" DB rows).
- `backend/internal/handler/api_batch_test.go`: provider/model resolver coverage updated for Gemini-only scenarios.
- `backend/internal/handler/api_batch.go`: all rendering calls Gemini; `normalizeProvider("openai") → "gemini"` for graceful legacy row handling.
- `backend/internal/handler/api_batch.go`: takes now store `provider_voice`, `app_voice_name`, `preset_id`, `style_id`, `accent_id`, `cast_profile_id`, `dictionary_hash`, `prompt_hash`, and `settings_json`.
- `components/ProjectWorkspace.tsx`: project settings include fallback provider/model; segment editor includes provider/model and fallback overrides; segment rows show provider/fallback badges.
- `components/SegmentTakeList.tsx`: take rows show provider/model, mapped provider voice, language, style, and prompt hash badges.
- Verified: `go test ./...` from `backend` passes; `npx tsc --noEmit` clean; `npm run build` succeeds with the existing large-chunk warning.

Not yet done:
- Provider capability badges in UI (Phase 1 UI) — deferred.
- Provider comparison A/B render (Phase 6) — deferred.

~~OpenAI key section in SettingsModal~~ — removed.
~~Provider voice mapping management UI~~ — routes and frontend functions removed.

---

### Plan 11 — Deliverable Packaging
**Status: Complete.**

Done:
- `export_profiles` migration, store, handlers, frontend API functions, and picker exist via Plan 05.
- `export_jobs` + `export_job_items` tables — migration `020_export_jobs.sql` with CASCADE indexes.
- `store/export_jobs.go` — `CreateExportJob`, `GetExportJob`, `ListExportJobs`, `UpdateExportJobStatus` with `ExportJob` struct.
- `store.go` `validateSchema` updated with both new tables.
- `backend/internal/exporter/exporter.go` — `Run(ctx, cfg, jobID, projectID)` goroutine: builds ZIP with `audio/*.wav` (PCM→WAV), `project.json`, `cast-bible.json`, `pronunciation-dictionary.json`, `qc-notes.csv`, `render-metadata.json`, `README.txt`.
- `handler/api_exports.go` — `ExportsHandler` with `StartExport` (POST, 202), `ListExports` (GET), `GetExport` (GET), `DownloadExport` (GET, streams ZIP).
- `server.go` + `routes.go` — `ExportCacheDir` derived via `filepath.Dir(audioCacheDir)`, all 4 routes registered.
- `types.ts` — `ExportJob` interface.
- `api.ts` — `startExport`, `getExport`, `listExports`, `downloadExport`.
- `components/ExportDialog.tsx` — modal with profile picker, start/poll/download flow, focus trap, ARIA.
- `components/ProjectWorkspace.tsx` — Export toolbar button (`Package` icon) + `showExport` state + `ExportDialog` mount.
- All tests pass (`go test ./...`), `npx tsc --noEmit` clean, `npm run build` clean.

Not yet done:
- Filename template resolution (e.g. `{speaker}-{index:03d}`) — deferred to later polish.

---

### Plan 12 — AI Script Prep for Narration
**Status: Phase 1/2/3 complete for reviewed apply workflow. Phase 4 basic cast/dictionary integration complete. Phase 5 long-manuscript chunking deferred.**

Done:
- `POST /api/voices/format-script` exists for simple single-pass formatting.
- `ScriptReaderModal` has a Format button wired to it.
- `backend/internal/gemini.Client.PrepareScriptForNarration()` returns structured JSON with sections, segments, speakers, pronunciation candidates, style suggestions, and warnings.
- Migration `021_script_prep_jobs.sql` and `backend/internal/store/script_prep.go` persist prep jobs, raw script hash, raw script, result JSON, status, and errors.
- `POST /api/projects/{id}/prepare-script` creates a prep job, calls Gemini, stores the result, and returns the job.
- `GET /api/projects/{id}/prepare-script` returns the latest prep job for a project.
- `POST /api/projects/{id}/script-prep/apply` safely appends reviewed prep results to project sections/segments and can optionally materialize speaker candidates as cast profiles and pronunciation candidates as entries in an `AI Script Prep` project dictionary.
- `api.ts` includes `prepareScript`, `getLatestScriptPrep`, and `applyScriptPrep`; `types.ts` includes prep result/job/apply types.
- `components/ScriptPrepDialog.tsx` previews proposed sections, detected speakers, pronunciation hints, style suggestions, warnings, and apply options.
- `components/ProjectWorkspace.tsx` has a `Prep` toolbar action, mounts `ScriptPrepDialog`, refreshes project contents after apply, and reports the applied section/segment counts.

Not yet done:
- Long-manuscript chunking and reconciliation through the job center.

---

### Plan 13 — Mobile and Narrow-Screen Workflow
**Status: Phase 1 complete. Phase 2 complete for Review Mode transport. Phase 3 started.**

Done:
- `NavigationSidebar.tsx` already switches to mobile bottom tab bar below 1280 px.
- `BottomSheet.tsx` exists and is used in `HistoryPanel`.
- Mobile-first Tailwind breakpoints used throughout.
- `components/useResponsiveMode.ts`: centralized `desktop` / `tablet` / `phone` layout hook.
- `components/ProjectWorkspace.tsx`: phone workspace tabs for Script / Cast / Takes / Jobs / Review, with a compact mobile jobs list fed by `useJobs()`.
- `components/ProjectWorkspace.tsx`: mobile tab selection coordinates the Cast and Review surfaces and avoids showing the project sidebar outside the Script tab.
- `components/ReviewMode.tsx`: narrow screens switch from side-by-side queue/review layout to stacked queue + review content.
- `components/ReviewTransport.tsx`: larger 44px-class touch targets and sticky mobile placement in Review Mode.

Not yet done:
- Dedicated bottom-sheet segment inspector.
- Take list swipe/menu actions.
- Playwright viewport smoke scripts for desktop/tablet/phone layout checks.

---

### Plan 14 — Production Settings and Defaults
**Status: Phase 1 complete. Phase 2 complete. Phase 3 complete.**

Phase 1 done (2026-04-25):
- `SettingsModal.tsx` fully rewritten from a flat 513-line modal to a 4-tab interface: **Keys / Render / Storage / Appearance**.
- `App.tsx` passes `isDarkMode`, `onToggleDark`, `accentColor`, `onAccentChange`, `highContrast`, `onHighContrastChange` as new props to SettingsModal.
- **Keys tab**: API key save/test/delete, show/hide toggle, rotation pool management, Google AI Studio link.
- **Render tab**: Default TTS model (selector over `GEMINI_MODELS`), default language code, batch concurrency slider, retry count slider, continue-on-error toggle — all persisted to backend `config` table via `getConfig`/`updateConfig`.
- **Storage tab**: Cache stats display with clear button; backup download and restore from DB file.
- **Appearance tab**: Light/Dark theme toggle (calls `onToggleDark`), accent color swatches (6 options, persists via `onAccentChange`), high-contrast toggle.
- Modal widened to `max-w-xl`; tab bar uses segmented-control pill style; tab content in `max-h-[60vh] overflow-y-auto` panel.
- `npx tsc --noEmit` and `npm run build` both pass.

Phase 2 done (2026-04-25):
- `backend/internal/store/config.go`: Added `ConfigKey*` string constants for all 12 well-known config keys (`ConfigKeyDefaultModel`, `ConfigKeyDefaultLanguageCode`, `ConfigKeyDefaultBatchConcurrency`, `ConfigKeyDefaultRetryCount`, `ConfigKeyContinueBatchOnError`, `ConfigKeyDefaultProvider`, `ConfigKeyFallbackProvider`, `ConfigKeyFallbackModel`, `ConfigKeyLastOpenProjectID`, `ConfigKeyAppearanceTheme`, `ConfigKeyAppearanceAccentColor`, `ConfigKeyAppearanceHighContrast`).
- `backend/internal/store/config.go`: Added `GetConfigValue(key, defaultVal string) string` convenience helper — wraps `GetConfig`, returns `defaultVal` if key missing or empty.
- `backend/internal/store/config_test.go`: New `TestGetSetConfigValue` covering missing-key default, stored value retrieval, empty-value default, and batch upsert; all pass.
- `backend/internal/handler/api_batch.go`: Migrated all 6 raw `GetConfig("...")` string literals to typed store constants (`store.ConfigKeyDefaultLanguageCode`, `store.ConfigKeyDefaultProvider`, `store.ConfigKeyDefaultModel`, `store.ConfigKeyFallbackProvider`, `store.ConfigKeyFallbackModel`).
- `api.ts`: Added `CONFIG_KEYS` `as const` object and `ConfigKey` union type for all 12 config keys; placed in the `--- Config ---` section before `getConfig`/`updateConfig`.
- `components/ProjectWorkspace.tsx`: Imported `CONFIG_KEYS` from `../api`; migrated `cfg['last_open_project_id']` and `updateConfig({ last_open_project_id: ... })` to typed keys.
- `components/SettingsModal.tsx`: Imported `CONFIG_KEYS` from `../api`; migrated `loadRenderDefaults` to use `cfg[CONFIG_KEYS.DEFAULT_MODEL]` etc.
- `go test ./...`, `npx tsc --noEmit`, and `npm run build` all pass.

Phase 3 done (2026-04-25):
- `SettingsModal.tsx`: expanded tabs from Keys / Render / Profiles / Storage / Appearance to Keys / Render / Export / Dicts / QC / Storage / Appearance, with horizontal tab overflow for narrow screens.
- `components/GlobalPronunciationSettings.tsx`: global reusable dictionary manager in Settings with create/rename/delete dictionary, add/toggle/delete rules, regex flag support, and preview.
- Migration `022_global_pronunciation.sql`: `global_pronunciation_dictionaries` and `global_pronunciation_entries`.
- `backend/internal/store/pronunciation.go`: global dictionary/entry CRUD plus render-time `ListEnabledEntriesForProject()` now applies global enabled entries before project entries.
- `backend/internal/handler/api_pronunciation.go` + `routes.go`: `/api/pronunciation/dictionaries...` global dictionary routes and preview route.
- `api.ts` and `types.ts`: global pronunciation API client functions and optional dictionary `scope`.
- `components/QcRulesSettings.tsx`: QC tab for default severity, clipping auto-flagging, peak threshold, approved-only export packaging, and default QC note export format.
- `backend/internal/store/config.go` and `api.ts`: typed QC config keys added.
- `QcIssueDialog.tsx`: new QC issues default severity from settings.
- `api_batch.go`: render path can auto-create high-severity QC issues for clipped/near-0 dBFS output according to QC settings.
- `api_qc.go`: QC export defaults to the configured CSV/Markdown format when no `format` query is provided.
- `exporter.go`: deliverable packaging honors `qc_export_only_approved`.
- `ExportDialog.tsx`: default export profile from settings is preselected.
- `go test ./...`, `npx tsc --noEmit`, and `npm run build` all pass.

Not yet done:
- Provider capability badges in Settings Keys tab are still deferred to later provider-comparison work.
- Storage cleanup controls for old jobs/exports remain deferred.

---

## Existing Utility Components (Pre-Date the Plan Docs)

The following components exist and are wired up but are not individually tracked as implementation slices because they were already present when the plan docs were written:

| Component | Status |
|---|---|
| `AudioProvider.tsx` | Done — unified AudioContext provider, MiniPlayer integration |
| `MiniPlayer.tsx` | Done — persistent bottom player bar |
| `CommandPalette.tsx` | Done — keyboard-triggered command palette |
| `OnboardingTour.tsx` | Done — first-run tour |
| `KeyboardShortcutsModal.tsx` | Done — shortcut reference modal |
| `NavigationSidebar.tsx` | Done — sidebar + mobile bottom tabs |
| `BottomSheet.tsx` | Done — responsive modal/sheet used in HistoryPanel |
| `SplitPane.tsx` | Done — resizable two-pane layout shell (not yet used in production workspace) |
| `SkeletonCard.tsx` | Done — loading placeholder card |
| `ScriptHighlighter.tsx` | Done — script syntax highlighting used in ScriptReaderModal |
| `AudioTagsToolbar.tsx` | Done — audio tag insertion toolbar used in ScriptReaderModal |
| `VoiceCompare.tsx` | Done — side-by-side voice comparison |
| `PresetArtwork.tsx` | Done — preset headshot/image display with fallback |

---

## Status Updates (Chronological)

- 2026-04-24: Read all Markdown docs in `docs_internal`.
- 2026-04-24: Validated the plan against current code and selected the job center plus history normalization as the first implementation slice.
- 2026-04-24: Added optional progress event metadata fields for future job, item, project, and segment tracking.
- 2026-04-24: Added frontend `JobProvider` and `JobCenter` using the existing `/api/ws/progress` stream.
- 2026-04-24: Added progress events for AI casting, multi-speaker TTS, script formatting, and streaming TTS paths.
- 2026-04-24: Normalized frontend history handling for backend `tts_multi` entries.
- 2026-04-24: Reviewed this tracker for accuracy; it correctly described the completed first slice and the missing persisted job state.
- 2026-04-24: Added persisted `jobs` and `job_items` SQLite tables.
- 2026-04-24: Added backend job store methods for progress upsert, list, and get.
- 2026-04-24: Added `GET /api/jobs` and `GET /api/jobs/{id}` for startup reconciliation and inspection.
- 2026-04-24: Updated the progress hub so progress events are stored before they are broadcast.
- 2026-04-24: Updated the frontend job provider to hydrate from `/api/jobs` and then merge live WebSocket events.
- 2026-04-24: Added direct Go coverage for persisted job progress updates.
- 2026-04-24: Reviewed this tracker again for accuracy; the completed job slices were accurate and the script project slice was still pending.
- 2026-04-24: Added minimal `script_projects`, `script_sections`, and `script_segments` SQLite tables and schema validation entries.
- 2026-04-24: Added backend store CRUD/list methods for script projects, sections, and segments.
- 2026-04-24: Added basic project HTTP routes under `/api/projects`.
- 2026-04-24: Added frontend TypeScript project/section/segment types and API client functions.
- 2026-04-24: Added direct Go coverage for project, section, segment, archive, and dirty-status behavior.
- 2026-04-24: Added a lightweight `ProjectWorkspace` shell in the Script section.
- 2026-04-24: Preserved the existing `ScriptReaderModal.tsx` as a compact script reader inside the new workspace.
- 2026-04-24: Project workspace can list projects, create projects, select a project, show section/segment counts, show segment previews, refresh, and archive a project.
- 2026-04-24: Full codebase audit performed; progress document expanded with per-plan status detail and utility component inventory.
- 2026-04-24: Added `POST /api/projects/{id}/import` backend endpoint with heading-to-section, paragraph-to-segment parsing; registered in routes.go.
- 2026-04-24: Added `TestSplitParagraphs` (9 cases) in `backend/internal/handler/api_projects_test.go`.
- 2026-04-24: Added `importProjectText()` in `api.ts`.
- 2026-04-24: Rewrote `ProjectWorkspace.tsx` with inline section/segment CRUD, color-coded status badges, import panel (paste + file picker), expand/collapse sections, and `last_open_project_id` config persistence.
- 2026-04-24: Added project settings panel (default voice dropdown, language code, provider, model) — saves via `PUT /api/projects/{id}`.
- 2026-04-24: Added section `kind` selector (chapter/scene/folder) in the inline rename flow.
- 2026-04-24: Added per-segment speaker label input and voice name override dropdown in the inline segment editor; both shown as badges on segment rows.
- 2026-04-24: Re-reviewed this tracker against production code after Plan 05 implementation. Updated Plan 05 and Plan 11 status language, and recorded correctness gaps for migration idempotency, take route ownership, audio metric population, and selected-segment batch render serialization.
- 2026-04-25: Hardened Plan 05 foundation: migration `012_take_metadata.sql` is restart-safe; segment takes store peak/RMS/clipping/sample rate/channels/format; backend renders populate take metadata; nested take/audio/note routes enforce project + segment + take ownership; selected batch render serialization sends `segment_ids`.
- 2026-04-25: Added `backend/internal/audio` PCM analysis utilities with direct unit coverage.
- 2026-04-25: Added focused store/handler tests for take metadata persistence, mismatched segment rejection, scoped note deletion, and nested take route behavior.
- 2026-04-25: Implemented Plan 06 Phase 1 data model with `cast_profiles` and `cast_profile_versions`.
- 2026-04-25: Implemented Plan 06 Phase 2 backend APIs and frontend API/types for project cast profiles, versions, revert, and audition.
- 2026-04-25: Added store and handler tests for cast profile CRUD, version snapshots, revert, and delete routes.
- 2026-04-24: Implemented Plan 06 Phase 3 Cast Board UI: CastProfileCard, CastProfileEditor, CastAuditionPanel, and CastBoard components. Wired "Cast" toolbar button and panel into ProjectWorkspace. npx tsc --noEmit and npm run build both pass.
- 2026-04-24: Implemented Plan 06 Phase 4: added `cast_profile_id` to `script_segments` (migration 015 + addColumnIfMissing); updated ScriptSegment struct and all SQL in projects.go; renderOneSegment resolves voice through cast profile first; types.ts updated; segment editor now shows grouped cast-profile/voice select with auto-fill and violet badge; CastProfileEditor has collapsible version history with revert; CastContinuityWarnings new component wired into CastBoard. All builds and tests pass.
- 2026-04-25: Re-checked tracker accuracy. Plans 07, 08, and 09 were already complete, so the true next three phases were Plan 10 Phase 3, Phase 4, and Phase 5.
- 2026-04-25: Implemented Plan 10 Phase 3 provider/model default resolution: segment override, project default, client default, global config, then registry default.
- 2026-04-25: Implemented Plan 10 Phase 4 fallback and provider voice mapping support: fallback provider/model columns, `provider_voice_mappings` migration/store/API/client, Gemini/OpenAI batch render routing, project/global mapping lookup, and approved/locked fallback guard.
- 2026-04-25: Implemented Plan 10 Phase 5 render metadata: takes now store provider voice/app voice, preset/style/accent/cast IDs, dictionary/prompt hashes, and render settings JSON; ProjectWorkspace and SegmentTakeList show provider/model/reproducibility badges.
- 2026-04-25: Removed all OpenAI support (see `remove-openai-plan.md`). Deleted `backend/internal/openai/` package; removed OpenAI branch from api_batch.go, api_voices.go, api_keys.go; removed OpenAI entry from provider registry; de-registered provider-voice-mapping routes; removed OpenAI key section from SettingsModal; removed `ProviderVoiceMapping`/`UpsertProviderVoiceMappingInput` from types.ts and api.ts; fixed all backend tests. All providers normalize to "gemini" (including legacy "openai" DB rows). go test ./..., npx tsc --noEmit, and npm run build all pass.
- 2026-04-25: Implemented Plan 11 Deliverable Packaging: migration 020 (export_jobs + export_job_items), store/export_jobs.go, store.go validateSchema update, backend/internal/exporter/exporter.go (ZIP builder with WAV audio + project/cast/pronunciation/QC/render-metadata files), handler/api_exports.go (StartExport, ListExports, GetExport, DownloadExport), server.go wiring (ExportCacheDir derivation), routes.go (4 new routes), types.ts ExportJob interface, api.ts export functions, components/ExportDialog.tsx (modal with polling + download), components/ProjectWorkspace.tsx Export toolbar button. go test ./..., npx tsc --noEmit, npm run build all pass.
- 2026-04-25: Implemented Plan 14 Phase 1 Settings Information Architecture: rewrote SettingsModal.tsx (513 → ~870 lines) with 4-tab layout (Keys / Render / Storage / Appearance); added Render Defaults tab backed by backend config API; added Appearance tab with theme toggle, 6 accent swatches, high-contrast toggle; updated App.tsx to pass 6 new props to SettingsModal; modal widened to max-w-xl with segmented-control tab bar. npx tsc --noEmit and npm run build both pass.
- 2026-04-25: Implemented Plan 14 Phase 2 Typed Config Keys: added 12 `ConfigKey*` string constants and `GetConfigValue(key, defaultVal)` helper to `backend/internal/store/config.go`; new `config_test.go` (`TestGetSetConfigValue`, all pass); migrated 6 raw string literals in `api_batch.go` to typed store constants; added `CONFIG_KEYS` as-const object and `ConfigKey` union type to `api.ts`; migrated `ProjectWorkspace.tsx` and `SettingsModal.tsx` to use typed keys. go test ./..., npx tsc --noEmit, npm run build all pass.
- 2026-04-25: Re-reviewed the recommended-next section. Plan 12 was already in progress: Gemini prep method, script prep migration/store, prepare route/API/types, and `ScriptPrepDialog.tsx` existed but lacked workspace wiring and safe apply.
- 2026-04-25: Implemented Plan 14 Phase 3 Settings tabs: Export tab default profile is consumed by `ExportDialog`; global pronunciation dictionaries have migration/store/handler/API/settings UI and are applied before project dictionaries during render; QC Rules tab persists default severity, clipping auto-flag, peak threshold, approved-only export, and note export format.
- 2026-04-25: Implemented Plan 12 safe apply: `POST /api/projects/{id}/script-prep/apply`, store transaction to append sections/segments, optional cast profile creation, optional `AI Script Prep` pronunciation entries, `applyScriptPrep()` client function, and ProjectWorkspace `Prep` toolbar integration.
- 2026-04-25: Implemented Plan 13 mobile pass: `useResponsiveMode()`, phone workspace tabs, compact Jobs tab, stacked Review Mode layout, and sticky/touch-sized ReviewTransport controls.

---

## Verification Log

- Passed: `npm run build`.
- Passed: `go test ./...` from `backend`.
- Passed: `npm run build` after job persistence/reconciliation changes.
- Passed: `go test ./...` from `backend` after adding `backend/internal/store/jobs_test.go`.
- Passed: `go test ./...` from `backend` after adding the script project backend contract.
- Passed: `npm run build` after adding frontend project API/types.
- Passed: `npm run build` after wiring the project workspace shell into the Script section.
- Passed: `go test ./...` from `backend` after the workspace shell change.
- Passed: `go test ./...` from `backend` after adding `TestSplitParagraphs` for the import parser.
- Passed: `npm run build` after the full ProjectWorkspace rewrite.
- Passed: `go test ./...` after ProjectWorkspace / import implementation.
- Passed: `npm run build` after project settings panel, section kind, and segment speaker/voice override.
- Passed: `go test ./...` — all cached (no backend changes this session).
- Passed: `go test ./...` after Plan 04 Phase 2 backend (migration, store/takes.go, handler/api_takes.go, routes).
- Passed: `npm run build` after Plan 04 Phase 2 frontend (types.ts, api.ts, SegmentTakeList.tsx, ProjectWorkspace.tsx).
- Passed: `go test ./...` after Plan 02 Phase 2 backend (store UpdateSegmentStatus, handler/api_batch.go, routes).
- Passed: `npm run build` after Plan 02 Phase 2 frontend (api.ts, ProjectWorkspace Render All button, JobCenter cancel button).

- Passed: `go build ./...` after Plan 04 Phase 3 backend (RenderSegment handler, route).
- Passed: `npm run build` after Plan 04 Phase 3 frontend (reRenderSegment in api.ts, Re-render button in ProjectWorkspace).
- Passed: `go test ./...` after Plan 03 backend (migration, store, handler, pronunciation package, routes).
- Passed: `npm run build` after Plan 03 frontend (types.ts, api.ts, PronunciationEditor.tsx, ProjectWorkspace Dicts button).
- Passed: `npm run build` after Plan 02 Phase 3 (subscribeToProgress in JobProvider, real-time segment status subscription in ProjectWorkspace).
- Passed: `go test ./...` from `backend` during post-Plan 05 validation.
- Passed: `npm run build` during post-Plan 05 validation.
- Passed: `go build -buildvcs=false ./...` from `backend` during post-Plan 05 validation. Plain `go build ./...` was blocked by Git dubious-ownership/VCS stamping in the sandbox, not by a compile error.
- Passed: `go test ./internal/audio ./internal/store ./internal/handler` after Plan 05 hardening.
- Passed: `go test ./internal/store ./internal/handler ./internal/server` after Plan 06 Phase 1/2 implementation.
- Passed: `go test ./...` from `backend` after Plan 06 Phase 1/2 implementation.
- Passed: `npx tsc --noEmit` after frontend type/API updates.
- Passed: `npm run build` after Plan 06 Phase 1/2 implementation. Vite still reports the existing large-chunk warning.
- Passed: `go build -buildvcs=false ./...` after Plan 07 implementation (removed duplicate `boolToInt` helper).
- Passed: `go test ./...` from `backend` after Plan 07 (all packages: audio, gemini, handler, promptbuilder, pronunciation, server, store).
- Passed: `npx tsc --noEmit` after Plan 07 frontend (types.ts, api.ts, 3 new components, ProjectWorkspace wiring).
- Passed: `npm run build` after Plan 07 frontend (806 kB bundle, large-chunk warning only).
- Passed: `npx tsc --noEmit` after Plan 06 Phase 3 Cast Board UI.
- Passed: `npm run build` after Plan 06 Phase 3 Cast Board UI. Large-chunk warning unchanged.
- Passed: `go build -buildvcs=false ./...` from `backend` after Plan 06 Phase 4.
- Passed: `go test ./...` from `backend` after Plan 06 Phase 4.
- Passed: `npx tsc --noEmit` after Plan 06 Phase 4.
- Passed: `npm run build` after Plan 06 Phase 4. Large-chunk warning unchanged.
- Passed: `go test ./internal/store` after adding `provider_voice_mappings` store coverage.
- Passed: `go test ./internal/handler` after adding provider/model resolver coverage.
- Passed: `go test ./internal/store ./internal/handler ./internal/server` after adding provider voice mapping handler coverage.
- Passed: `go test ./internal/store ./internal/handler ./internal/server` after Plan 10 Phase 3-5 backend changes. One sandboxed package run hit `AppData\Local\go-build` access denied and was rerun with approved elevated cache access.
- Passed: `go test ./...` from `backend` after Plan 10 Phase 3-5.
- Passed: `npx tsc --noEmit` after Plan 10 Phase 3-5 frontend type/UI changes.
- Passed: `npm run build` after Plan 10 Phase 3-5. Large-chunk warning unchanged.
- Passed: `npx tsc --noEmit` after Plan 14 Phase 1 SettingsModal rewrite (no type errors).
- Passed: `npm run build` after Plan 14 Phase 1. 849 kB bundle, large-chunk warning only.
- 2026-04-25: Full OpenAI audit performed across all production source files. Findings: backend Go source has one intentional legacy-compat reference (`normalizeProvider("openai") → "gemini"` in `api_batch.go`). Frontend TypeScript/TSX source has zero OpenAI references. All Go test files are OpenAI-free. Planning doc `implementation-plan-00` stale "backend has an OpenAI TTS client" sentence updated to reflect removal. `implementation-plan-10` revision note already present. All other planning docs are accurate. No code changes required.
- Passed: `go test ./...` after Plan 14 Phase 2 (`TestGetSetConfigValue` + all existing store/handler tests pass).
- Passed: `npx tsc --noEmit` after Plan 14 Phase 2 (CONFIG_KEYS, ConfigKey, typed key migration).
- Passed: `npm run build` after Plan 14 Phase 2. 850 kB bundle, large-chunk warning only.
- Passed: `go test ./...` after Plan 14 Phase 3, Plan 12 apply route, and Plan 13 mobile pass.
- Passed: `npx tsc --noEmit` after Settings Dicts/QC tabs, script-prep apply wiring, and responsive workspace updates.
- Passed: `npm run build` after Settings Dicts/QC tabs, script-prep apply wiring, and responsive workspace updates. Vite large-chunk warning remains.

---

## Recommended Next Implementation Slice

**Plan 13 polish, then remaining Plan 05/02 deferred workflow depth.**

Plan 14 Phase 3 and the previously missing Plan 12 apply path are complete. The next highest-value work:

1. **Plan 13 polish**: bottom-sheet segment inspector, take-list menu/swipe actions, and Playwright viewport smoke scripts.
2. **Plan 05 timeline/export depth**: marker workflows, true timeline seek, async export metadata, and MP3/M4B strategy.
3. **Plan 02 queue depth**: worker concurrency, pause/resume, and retry job routes.
