# Audiobook and Voiceover Creator Enhancement Ideas

## Current Product Baseline

Gemini Voice Library already covers the discovery and preview layer well: stock voice browsing, AI casting, custom presets, script reading, multi-speaker dialogue, accent prompting, language selection, history, favorites, backup/restore, and local encrypted API key storage.

For audiobook and voiceover creators, the next step is less about adding another preview control and more about supporting a complete production workflow: organize scripts, cast characters, render chapters or spots, review takes, fix only bad lines, finish audio, and export deliverables with repeatable settings.

## Accuracy Review and Implementation Plans

This document has been reviewed against the current codebase. The detailed accuracy notes, UI/UX merge map, and implementation plan index are in [implementation-plan-00-accuracy-review-and-plan-map.md](implementation-plan-00-accuracy-review-and-plan-map.md).

## New Features, Ordered By Priority

### 1. Script Projects With Chapters, Scenes, and Segments

**Priority:** P0

Create persistent script projects backed by SQLite instead of relying on ephemeral Script Reader state and recent scripts in local storage.

**What to add:**
- Project records for audiobooks, ads, podcasts, training videos, and character reels.
- Chapter, scene, and segment entities with title, script text, voice assignment, accent, model, language, notes, and render status.
- "Resume last project" behavior after refresh or app restart.
- Import from `.txt` and `.md` first, then later `.docx`, `.epub`, and screenplay formats.
- Segment locking so approved lines do not change during later batch renders.

**Why it matters for creators:**
Audiobook and voiceover work is rarely a single text box. Creators need to keep a book, chapter, role, session, or client job together and come back to it repeatedly.

**Fit with current app:**
The Script Reader, history table, custom presets, and backup system already provide much of the foundation. This mostly needs new persistence, APIs, and a project-oriented UI.

### 2. Batch Rendering and Render Queue

**Priority:** P0

Add a render queue that can generate many script segments in one pass with real status, retries, and resumability.

**What to add:**
- Queue selected chapters, scenes, or all pending segments.
- Pause, resume, cancel, and retry failed renders.
- Render status per segment: draft, queued, rendering, failed, rendered, approved.
- Automatic retry rules for provider overloads.
- Optional key-pool usage visibility for high-volume jobs.
- ZIP export for chapter WAV files and project metadata.

**Why it matters for creators:**
Long-form narration requires dozens or hundreds of generation calls. Manual single-preview rendering is too slow for audiobook chapters, course modules, or bulk ad variants.

**Fit with current app:**
The backend already has a WebSocket progress hub and the frontend has a `connectProgress()` client. Those pieces should become a global job center before large batch features land.

### 3. Pronunciation Dictionary and Replacement Rules

**Priority:** P0

Add a project-level pronunciation system for names, fantasy terms, brand names, acronyms, URLs, numbers, and repeated phrases.

**What to add:**
- Dictionary entries with written form, spoken form, language/accent scope, and notes.
- Per-project and global dictionaries.
- Inline warnings for words not yet covered by the dictionary.
- Import/export dictionary JSON for client or series reuse.
- Preview pronunciation on a selected word without rendering the full segment.

**Why it matters for creators:**
Audiobooks and branded voiceovers fail quickly when character names, product names, or abbreviations drift between chapters. A pronunciation dictionary is a core production feature.

**Fit with current app:**
The existing script formatter and audio tags already modify how text is sent to TTS. Dictionary expansion can be applied as a pre-render transformation with clear review controls.

### 4. Take Management and Line-Level Re-Render

**Priority:** P0

Introduce multiple takes per segment and allow creators to regenerate only the problem line or paragraph instead of the whole script.

**What to add:**
- Save every generated output as a take with settings, timestamp, provider, model, and prompt metadata.
- Mark one take as selected or approved.
- Duplicate a take's settings for another attempt.
- Re-render selected text range or selected segment.
- Compare takes with quick A/B playback.
- Add reviewer notes such as "too fast", "wrong emphasis", or "needs warmer delivery".

**Why it matters for creators:**
Voiceover production is iterative. Creators need to keep good takes, discard weak takes, and regenerate small sections without losing the rest of the session.

**Fit with current app:**
History already stores generated audio and input text. This feature turns history from a passive log into an active production asset model.

### 5. Audio Finishing Pipeline

**Priority:** P1

Add production finishing tools so exports are closer to usable deliverables.

**What to add:**
- Loudness normalization presets for audiobook, podcast, broadcast, and web video targets.
- Peak limiting and clipping detection.
- Trim leading/trailing silence.
- Optional room tone or configurable silence between segments.
- Stitch rendered segments into chapters.
- Export WAV first, then MP3 and M4B where feasible.
- Generate chapter markers and simple cue sheets.

**Why it matters for creators:**
Creators need more than raw generated audio. Audiobook platforms, client deliverables, and editing workflows require consistent loudness, silence handling, and file organization.

**Fit with current app:**
The app already builds WAV files in the browser and caches raw PCM. Finishing can start with client-side processing, then move heavier or batch operations to the Go backend if needed.

### 6. Cast Bible for Characters and Narrator Continuity

**Priority:** P1

Create a cast-management layer for books, fiction podcasts, games, and dialogue-heavy scripts.

**What to add:**
- Character profiles with selected voice, accent, age impression, emotional range, pronunciation notes, and sample lines.
- Series-level cast reuse across projects.
- Warnings when a character changes voice or preset unexpectedly.
- "Audition this character" flow using a fixed sample line set.
- Relationship notes for narrator, protagonist, antagonist, side characters, and extras.

**Why it matters for creators:**
Long-form work depends on continuity. A character's voice should not accidentally shift between chapters or episodes.

**Fit with current app:**
Custom presets, tags, headshots, source queries, and version history are already close to a character profile system.

### 7. Performance Style Presets

**Priority:** P1

Separate "who is speaking" from "how they are performing."

**What to add:**
- Reusable style presets such as calm narration, suspense, intimate whisper, energetic ad read, explainer, documentary, trailer, and bedtime story.
- Pacing, energy, emotion, pause density, articulation, and emphasis guidance.
- Apply a style to a segment, scene, chapter, or full project.
- Save successful settings from a render as a style preset.

**Why it matters for creators:**
The same voice may need different delivery styles across chapter narration, dialogue, promotional reads, and course content.

**Fit with current app:**
System instructions, script templates, audio tags, and AI Casting Director output already use structured delivery guidance.

### 8. Review, QC, and Approval Workflow

**Priority:** P1

Add a lightweight production review mode for listening through generated content and marking issues.

**What to add:**
- Continuous playback through selected segments.
- Hotkeys for approve, flag, replay, next segment, previous segment, and create note.
- QC issue types: pronunciation, pacing, tone, volume, artifact, missing pause, wrong voice, bad emphasis.
- Filter project by unresolved issues.
- Export review notes as CSV or Markdown.

**Why it matters for creators:**
The bottleneck in audiobook work is often review, not generation. Fast listening and issue capture saves substantial time.

**Fit with current app:**
The Mini Player, history playback, keyboard shortcuts, and audio visualizer can become the basis of a focused review workflow.

### 9. Client/Brand Voiceover Workspaces

**Priority:** P2

Support short-form commercial and client work alongside long-form narration.

**What to add:**
- Client or brand records with preferred voices, pronunciation dictionary, approved style presets, and export naming rules.
- Script variant management for 15s, 30s, 60s, social, radio, and explainer versions.
- Batch render multiple variants from one campaign.
- Approval status and notes per variant.

**Why it matters for creators:**
Voiceover creators often repeat the same brand requirements across campaigns. Reusable client workspaces reduce setup time and mistakes.

**Fit with current app:**
Presets, tags, history search, and export/import are already useful primitives for this.

### 10. Provider and Model Strategy Per Project

**Priority:** P2

Expose provider/model decisions as part of production settings rather than hidden technical controls.

**What to add:**
- Project default provider and model.
- Provider fallback rules for overload or failed generation.
- History and take metadata showing provider, model, voice, language, and render parameters.
- Provider comparison render for the same line.
- Cost and estimated usage reporting where available.

**Why it matters for creators:**
Professional creators care about reproducibility, reliability, and cost. They need to know which model produced the approved take.

**Fit with current app:**
This application is Gemini-only. Render metadata (provider, model, voice, hashes) is already persisted per take for reproducibility and auditing.

### 11. Deliverable Packaging

**Priority:** P2

Create exports that match real delivery workflows.

**What to add:**
- Naming templates such as `{project}-{chapter}-{voice}-{take}`.
- Export profiles for audiobook chapter WAVs, podcast segments, ad variants, and raw editor handoff.
- Include project JSON, pronunciation dictionary, render notes, and cast bible in a delivery package.
- Export selected takes only, approved takes only, or all takes.

**Why it matters for creators:**
Clean handoff reduces friction with editors, clients, and publishing platforms.

**Fit with current app:**
History export, preset export/import, and backup already prove the app can package structured data.

### 12. AI Script Prep for Narration

**Priority:** P2

Extend AI formatting into a creator-facing preparation assistant.

**What to add:**
- Detect chapter headings, scene breaks, dialogue blocks, narrator sections, and character names.
- Suggest segment splits for easier re-rendering.
- Suggest speaker assignments in dialogue-heavy material.
- Identify likely pronunciation dictionary candidates.
- Recommend performance style by scene.

**Why it matters for creators:**
Raw manuscripts are not always ready for TTS. Good prep reduces render failures and makes long-form work manageable.

**Fit with current app:**
The existing `formatScript` endpoint is a good first version. This expands it from formatting text into preparing a project structure.

## UI/UX Enhancements, Ordered By Priority

### 1. Replace Modal-First Script Reader With a Production Workspace

**Priority:** P0

The Script Reader should become the main creator workspace, not a modal-like tool.

**Recommended layout:**
- Left rail: projects, chapters, scenes, and render status.
- Center pane: script editor with segment boundaries, speaker labels, tags, and pronunciation highlights.
- Right inspector: selected segment settings, voice, style, accent, take list, notes, and render actions.
- Bottom strip: transport controls, current render, waveform, and review status.

**Why this improves the experience:**
Creators need persistent context while working. A full workspace makes long-form production feel controlled instead of cramped.

### 2. Add a Global Job Center

**Priority:** P0

Show all active, completed, and failed renders in one predictable place.

**What it should include:**
- Queue drawer with job name, project, segment count, current status, percent, and error details.
- Inline progress indicators on chapters and segments.
- Toasts for completion and failures.
- Retry failed segments from the job center.

**Why this improves the experience:**
Batch rendering and headshot generation are async workflows. Users should never wonder whether the app is still working.

### 3. Segment-Based Editor With Render Status Badges

**Priority:** P0

Make script chunks visible and actionable.

**What it should include:**
- Segment cards or gutter markers beside the script.
- Status chips: draft, changed, queued, rendered, approved, flagged.
- Per-segment render, play, duplicate, approve, and notes controls.
- Dirty-state warnings when text changes after a segment has been rendered.

**Why this improves the experience:**
Audiobook production succeeds when creators can work line by line or paragraph by paragraph without losing the big picture.

### 4. Integrated Waveform and Timeline Review

**Priority:** P1

Move beyond a decorative visualizer into a useful review surface.

**What it should include:**
- Waveform for each rendered segment.
- Click-to-seek playback.
- Markers for notes, flags, and chapter boundaries.
- Basic region selection for line-level re-render or trim.
- Continuous chapter playback with visible current segment.

**Why this improves the experience:**
Creators review by listening. A timeline gives them the same mental model they use in audio editors.

### 5. Voice and Cast Board

**Priority:** P1

Create a visual planning board for narrators, characters, and saved voices.

**What it should include:**
- Cards grouped by narrator, main cast, supporting cast, extras, brand voices, and archived voices.
- Quick audition buttons using fixed sample lines.
- Side-by-side voice comparison for the same character line.
- Warnings for duplicate or too-similar character voices.

**Why this improves the experience:**
AI Casting is useful, but long-form creators need a persistent view of who is in the project and how they sound.

### 6. History Becomes an Asset Library

**Priority:** P1

History should expose production actions, not only playback and deletion.

**What it should include:**
- "Send to project", "Save as take", "Save as preset", "Reuse settings", and "Export audio" actions.
- Filters for project, chapter, voice, provider, model, status, and approved take.
- Small waveform or duration metadata for TTS entries.
- Better display for multi-speaker entries.

**Why this improves the experience:**
Creators often rediscover a good take later. The app should make old generations reusable.

### 7. Creator-Focused Empty States and Templates

**Priority:** P1

Use empty states to start real workflows instead of only describing missing content.

**What it should include:**
- New project templates: audiobook, fiction dialogue, commercial spot, explainer video, podcast intro, meditation, training module.
- Suggested starting structure for each template.
- Default export profile and style preset per template.
- Starter sample lines for auditioning voices.

**Why this improves the experience:**
Templates reduce setup friction and teach the production model without long instructions.

### 8. Better Mobile and Narrow-Screen Workflow

**Priority:** P2

The current app already has bottom navigation, but long-form script work needs more narrow-screen care.

**What it should include:**
- Split the production workspace into tabs on mobile: Script, Cast, Takes, Jobs, Review.
- Sticky transport controls.
- Large tap targets for play, approve, flag, and next segment.
- Avoid dense multi-column controls inside preview cards on small screens.

**Why this improves the experience:**
Creators may review audio on a tablet or laptop while away from their main editing setup.

### 9. Settings Reorganized Around Production Needs

**Priority:** P2

Settings currently centers on API keys and storage. Add creator-facing groups.

**Recommended groups:**
- Providers and keys.
- Render defaults.
- Export profiles.
- Pronunciation dictionaries.
- Storage and cache.
- Backup and restore.
- Accessibility and appearance.

**Why this improves the experience:**
As the app grows, creators should not need to hunt through technical settings to control everyday production defaults.

### 10. Trust and Reproducibility Indicators

**Priority:** P2

Show users exactly what produced an approved take.

**What it should include:**
- Compact metadata badges for provider, model, voice, accent, language, style, dictionary version, and render date.
- "Settings changed since last render" warnings.
- Compare-current-settings-to-approved-take view.
- Version history summaries for presets and style changes.

**Why this improves the experience:**
Creators need to recreate good results and explain deliverables to clients. Clear metadata builds trust.

## Suggested Implementation Order

1. Wire the existing WebSocket progress path into a global job center and replace simulated progress states.
2. Add a minimal project/segment schema and turn the Script Reader into a persistent project workspace.
3. Implement segment render status, take storage, and line-level re-render.
4. Add pronunciation dictionaries and apply them during pre-render text preparation.
5. Add batch rendering once the job center and segment model are stable.
6. Layer in audio finishing, cast bible, export packaging, and review workflows.

## Product Direction

The strongest direction is to position Gemini Voice Library as a local-first narration production studio:

- Fast enough for short voiceover tests.
- Organized enough for chapters and client jobs.
- Reliable enough for batch rendering.
- Detailed enough for pronunciation and continuity.
- Practical enough to export usable audio and production notes.

That keeps the app differentiated from simple TTS demos while building directly on the features already present in the codebase.
