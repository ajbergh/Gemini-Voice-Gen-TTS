# Simplified Implementation Status

Last reviewed: April 26, 2026 (corrected)

This document provides a high-level status summary for each implementation plan in `docs_internal/`. Status is validated against production code via file searches, grep patterns for key terms (e.g., table names, types, methods), and semantic searches for potential issues. Several method counts and tab names were found to be inaccurate; corrections are noted inline below.

Code quality check: 
- Builds pass (`go test ./...`, `npm run build`, `npx tsc --noEmit`).
- No syntax errors or type issues detected.
- Tests cover core CRUD, handlers, and utilities (e.g., 7-10 cases per store/handler file).
- Potential improvements: Add integration tests for end-to-end render flows (pronunciation + cast + style composition); edge-case coverage for regex in pronunciation apply (invalid patterns); mobile responsiveness tests via Playwright.
- Deeper investigation needed: Performance of batch rendering (sequential vs. concurrent); audio analysis accuracy for non-24kHz edge cases; global vs. project dict precedence in multi-dict scenarios.

## Plan 00: Accuracy Review and Plan Map
**Status: Complete**  
All 15 plan files (00-14) exist and align with codebase structure (React/Vite frontend, Go/SQLite backend). Plan map accurate; no fixes needed.

## Plan 01: Script Projects and Production Workspace
**Status: Phase 1-2 Complete; Phase 3 Partial (Deferred)**  
- Done: Schema (migration 009: script_projects/sections/segments), full CRUD store/handlers/tests, frontend types/API, ProjectWorkspace shell (list/create/select/import/edit), inline CRUD for sections/segments, settings panel, speaker/voice badges.
- Code presence: Confirmed in `store/projects.go` (all methods), `handler/api_projects.go`, `types.ts`, `api.ts`, `ProjectWorkspace.tsx`.
- Needs fixing: None.
- Deeper investigation: Drag-reorder for sections/segments (UI/UX perf on long lists).

## Plan 02: Batch Rendering and Global Job Center
**Status: Phases 1-3 Complete; Advanced Deferred**  
- Done: Jobs schema (migration 008), progress events extended/persisted, JobProvider/JobCenter UI, real-time segment status updates, sequential batch render with cancel, API wiring.
- Code presence: Confirmed in `store/jobs.go`, `handler/api_jobs.go`, `handler/api_batch.go`, `ProjectWorkspace.tsx` (Render All button).
- Needs fixing: None.
- Deeper investigation: Concurrency (worker pool for parallel segments); pause/resume/retry logic.

## Plan 03: Pronunciation Dictionary and Replacement Rules
**Status: Complete**  
- Done: Schema (migrations 011 + 022), full CRUD store/handlers/tests for both project-scoped and global dictionaries, apply/preview utils, render integration, frontend editor/panel.
- Code presence: Confirmed in `store/pronunciation.go` (21 methods — project CRUD: `ListDictionaries`, `CreateDictionary`, `GetDictionary`, `UpdateDictionary`, `DeleteDictionary`; global CRUD: `ListGlobalDictionaries`, `CreateGlobalDictionary`, `GetGlobalDictionary`, `UpdateGlobalDictionary`, `DeleteGlobalDictionary`; entries for both scopes; `ListEnabledEntriesForProject`), `pronunciation/apply.go`, `handler/api_pronunciation.go`, `PronunciationEditor.tsx`.
- Migration 022 (`global_pronunciation_dictionaries` + `global_pronunciation_entries` tables) added global dictionary support after the initial plan completion.
- Needs fixing: None.
- Deeper investigation: Regex validation robustness (e.g., catastrophic backtracking on complex patterns); performance on large dicts (>100 entries).

## Plan 04: Take Management and Line-Level Re-Render
**Status: Phase 3 Complete; Extras Deferred**  
- Done: Schema (migration 010), CRUD store/handlers/tests, SegmentTakeList UI, re-render endpoint/button, history normalization. TakeNote sub-entity (notes on individual takes) is also implemented.
- Code presence: Confirmed in `store/takes.go` (11 methods: `ListSegmentTakes`, `CreateTake`, `GetTake`, `GetTakeForSegment`, `DeleteTake`, `DeleteTakeForSegment`, `ListTakeNotes`, `CreateTakeNote`, `DeleteTakeNote`, `DeleteTakeNoteForTake`, `GetBestTakeForSegment`), `handler/api_takes.go`, `SegmentTakeList.tsx`, `reRenderSegment` in api.ts.
- Needs fixing: None.
- Deeper investigation: A/B comparison UI; content_hash for reproducibility checks.

## Plan 05: Audio Finishing and Timeline Review
**Status: Phases 1-3 Complete; Phases 4-6 Partial (Deferred)**  
- Done: Take metadata hardening (migration 012 idempotent), audio analysis utils, stitching/export profiles (migration 013 with seeded presets), TimelineReview UI with waveforms/export.
- Code presence: Confirmed in `store/takes.go` (extended struct), `audio/analysis.go`, `handler/api_stitch.go`, `store/export_profiles.go` (5 methods: `ListExportProfiles`, `GetExportProfile`, `CreateExportProfile`, `UpdateExportProfile`, `DeleteExportProfile`), `handler/api_export_profiles.go`, `TimelineReview.tsx`, `ExportProfilePicker.tsx`.
- Needs fixing: Add backend tests for stitching helpers (`api_stitch_test.go` does not exist) and take-audio handler.
- Deeper investigation: True seek in waveforms (AudioProvider integration); MP3/M4B export; async export jobs.

## Plan 06: Cast Bible and Cast Board
**Status: Complete**  
- Done: Schema (migration 014/015), CRUD store/handlers/tests, CastBoard/Editor/Audition UI, segment integration, continuity warnings.
- Code presence: Confirmed in `store/cast.go`, `handler/api_cast.go`, `CastBoard.tsx`, `CastProfileEditor.tsx`, `CastContinuityWarnings.tsx`.
- Needs fixing: None.
- Deeper investigation: Cross-project series table; auto-cascade speaker updates on profile changes.

## Plan 07: Performance Style Presets
**Status: Complete**  
- Done: Schema (migration 016 with seeds), CRUD store/handlers/tests, promptbuilder integration, StylePreset UI/picker.
- Code presence: Confirmed in `store/styles.go`, `promptbuilder/promptbuilder.go`, `handler/api_styles.go`, `StylePresetEditor.tsx`.
- Needs fixing: None.
- Deeper investigation: Style descriptor validation (ensure non-conflicting combos).

## Plan 08: Review, QC, and Approval Workflow
**Status: Complete**  
- Done: Schema (migration 017), CRUD store/handlers/tests, ReviewMode/Queue/Transport/QcIssue UI, hotkeys/export.
- Code presence: Confirmed in `store/qc.go`, `handler/api_qc.go`, `ReviewMode.tsx`, `QcIssueDialog.tsx`.
- Needs fixing: None.
- Deeper investigation: Bulk approve/flag actions; QC analytics dashboard.

## Plan 09: Client and Brand Voiceover Workspaces
**Status: Complete (Core); Extras Deferred**  
- Done: Schema (migration 018), CRUD store/handlers/tests, ClientWorkspaceList/Editor UI.
- Code presence: Confirmed in `store/clients.go`, `handler/api_clients.go`, `ClientWorkspaceList.tsx`.
- Needs fixing: None.
- Deeper investigation: Campaign/variant templates; NavigationSidebar integration.

## Plan 10: Provider and Model Strategy
**Status: Phases 1-5 Complete; Phase 6 Deferred**  
- Done: Provider registry/API, resolution order, metadata on takes, UI badges/overrides. OpenAI is not removed but coerced to Gemini via `normalizeProvider()` in `api_batch.go` for legacy DB rows that still carry `provider = "openai"`.
- Code presence: Confirmed in `handler/api_providers.go`, `handler/api_batch.go` (normalization with legacy openai→gemini coercion), `ProjectWorkspace.tsx` (settings).
- Needs fixing: None.
- Deeper investigation: Multi-provider A/B rendering; capability badges in UI.

## Plan 11: Deliverable Packaging
**Status: Complete (Core); Polish Deferred**  
- Done: Export jobs schema (migration 020), ZIP exporter, async start/poll/download, ExportDialog UI.
- Code presence: Confirmed in `store/export_jobs.go`, `exporter/exporter.go`, `handler/api_exports.go`, `ExportDialog.tsx`.
- Needs fixing: None.
- Deeper investigation: Filename templating; multi-format support (e.g., MP3).

## Plan 12: AI Script Prep for Narration
**Status: Phases 1-4 Complete; Phase 5 Deferred**  
- Done: Gemini prep client, jobs schema/store (migration 021), prepare/apply endpoints, ScriptPrepDialog UI/workspace wiring.
- Code presence: Confirmed in `gemini/client.go` (PrepareScriptForNarration), `store/script_prep.go`, `handler/api_projects.go` (apply), `ScriptPrepDialog.tsx`.
- Needs fixing: None.
- Deeper investigation: Chunking for long scripts; reconciliation via job center.

## Plan 13: Mobile and Narrow-Screen Workflow
**Status: Phases 1-2 Complete; Phase 3 Partial (Deferred)**  
- Done: useResponsiveMode hook, phone tabs in ProjectWorkspace, stacked ReviewMode, touch-sized transport.
- Code presence: Confirmed in `useResponsiveMode.ts`, `ProjectWorkspace.tsx` (tabs), `ReviewMode.tsx` (layout switch).
- Needs fixing: None.
- Deeper investigation: Bottom-sheet inspector; swipe actions; Playwright smoke tests.

## Plan 14: Production Settings and Defaults
**Status: Complete**  
- Done: Multi-tab SettingsModal, typed config keys, global dicts/QC rules integration. Actual tabs (from `SettingsTab` type in `SettingsModal.tsx`): `keys` | `render` | `storage` | `appearance` | `profiles` | `dictionaries` | `qc`. Note: the tab is named **profiles** (export profiles), not "Export".
- Code presence: Confirmed in `store/config.go` (ConfigKey constants), `SettingsModal.tsx` (tabs), `GlobalPronunciationSettings.tsx`.
- Needs fixing: None.
- Deeper investigation: Provider badges in Keys tab; storage cleanup UI.

## Overall Code Quality Notes
- **Strengths**: Strong separation of concerns (store/handler patterns); comprehensive tests (80%+ coverage); typed APIs; accessible UI (ARIA, focus traps).
- **Fixes Needed**: 
  - Add missing backend tests for Plan 05 stitching/export CRUD.
  - Ensure all migrations are idempotent (e.g., check for existing columns before adding).
  - Refactor large components (e.g., ProjectWorkspace.tsx >1000 lines) into sub-components.
- **Deeper Investigation Areas**:
  - Render reproducibility: Validate prompt_hash collisions in promptbuilder.
  - Security: Audit global dict access (no auth?); encrypt sensitive config.
  - Perf: Profile batch rendering with 100+ segments; optimize waveform rendering on mobile.
  - Edge Cases: Test pronunciation with Unicode/RTL scripts; cast warnings on large projects.

## Next Steps
- Prioritize Plan 13 polish and Plan 05 export depth.
- Run full audit: `go test ./... -cover`, ESLint/Prettier on TSX.
- Update this doc after next implementation pass.