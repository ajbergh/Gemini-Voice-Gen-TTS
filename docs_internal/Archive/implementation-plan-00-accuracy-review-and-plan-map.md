# Accuracy Review and Implementation Plan Map

## Review Summary

The enhancement document is accurate as a product-direction document. Its main claims line up with the current repository:

- The app is a React/Vite frontend with a Go backend, SQLite persistence, embedded frontend support, encrypted API key storage, audio cache, backup/restore, and preset/version/tag support.
- The app already has stock voice browsing, AI Casting Director, Script Reader, multi-speaker dialogue, language/accent controls, audio tags, streaming TTS, history, favorites, command palette, onboarding, and a mini player.
- The Script Reader is still not a durable production project system. It uses component state and a small `recentScripts` localStorage list rather than backend-backed projects, chapters, segments, takes, or approvals.
- The backend already exposes `/api/ws/progress` and the frontend has `connectProgress()` in `api.ts`, but the main UI does not yet use it as a global job center.
- The backend TTS pipeline is Gemini-only. An OpenAI path existed briefly as a multi-provider experiment (Plan 10) and was fully removed 2026-04-25 (see `remove-openai-plan.md`). All providers normalize to `"gemini"` including any legacy DB rows that carried `provider = "openai"`.
- History and preset export/import are real foundations for asset-library and packaging workflows.

## Accuracy Notes and Adjustments

- History currently stores `recommendation`, `tts`, and backend multi-speaker generations insert `tts_multi`, but the frontend `HistoryEntry` type and filter UI only model `tts` and `recommendation`. Implementation plans should normalize this before expanding history into takes.
- The mini player exists through `AudioProvider`, but several playback surfaces still manage their own `AudioContext`. Plans that rely on a unified review/player experience should first consolidate playback through `AudioProvider`.
- MP3 and M4B export should be phased carefully. The current stack is pure Go and browser-first audio handling; start with WAV and ZIP packaging, then add MP3/M4B behind an explicit encoder strategy.
- The progress hub emits only a thin set of events today. Batch rendering, preset headshot generation, script formatting, imports, and exports need standardized job IDs and status events before the UI can truthfully show all work.
- Provider/model metadata is not currently stored in `history`, so reproducibility indicators require schema changes before the UI can display them accurately.

## Plan Files Created

### Major New Feature Plans

1. [Script Projects and Production Workspace](implementation-plan-01-script-projects-workspace.md)
2. [Batch Rendering and Global Job Center](implementation-plan-02-batch-rendering-job-center.md)
3. [Pronunciation Dictionary and Replacement Rules](implementation-plan-03-pronunciation-dictionary.md)
4. [Take Management and Line-Level Re-Render](implementation-plan-04-take-management-line-rerender.md)
5. [Audio Finishing and Timeline Review](implementation-plan-05-audio-finishing-timeline-review.md)
6. [Cast Bible and Cast Board](implementation-plan-06-cast-bible-cast-board.md)
7. [Performance Style Presets](implementation-plan-07-performance-style-presets.md)
8. [Review, QC, and Approval Workflow](implementation-plan-08-review-qc-approval-workflow.md)
9. [Client and Brand Voiceover Workspaces](implementation-plan-09-client-brand-workspaces.md)
10. [Provider and Model Strategy](implementation-plan-10-provider-model-strategy.md)
11. [Deliverable Packaging](implementation-plan-11-deliverable-packaging.md)
12. [AI Script Prep for Narration](implementation-plan-12-ai-script-prep-narration.md)

### Unique Cross-Cutting UI/UX Plans

13. [Mobile and Narrow-Screen Workflow](implementation-plan-13-mobile-narrow-screen-workflow.md)
14. [Production Settings and Defaults](implementation-plan-14-production-settings-and-defaults.md)

## UI/UX Merge Map

- Production workspace, segment editor, project templates: merged into Script Projects.
- Global job center: merged into Batch Rendering.
- Integrated waveform and timeline review: merged into Audio Finishing.
- Voice and cast board: merged into Cast Bible.
- History as an asset library: merged into Take Management.
- Trust and reproducibility indicators: merged into Take Management and Provider Strategy.
- Settings reorganization: kept as its own cross-cutting plan because it touches providers, render defaults, export profiles, dictionaries, storage, backup, and accessibility.
- Mobile and narrow-screen workflow: kept as its own cross-cutting plan because every production feature needs a responsive interaction model.

