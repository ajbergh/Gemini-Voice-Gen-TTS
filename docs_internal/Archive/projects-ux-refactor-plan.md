# Projects UI/UX Refactor Plan

> **Audit date:** April 2026  
> **Audited at:** 1770×949px viewport, dark mode, Go backend running, Playwright walk-through of every panel  
> **Current file:** `components/ProjectWorkspace.tsx` (~1600+ lines)

## Implementation Status

| Phase | Title | Status | Completed |
|-------|-------|--------|-----------|
| Phase 1 | Fix the bugs | ✅ Complete | April 2026 |
| Phase 2 | Navigation restructure | ✅ Complete | April 2026 |
| Phase 3 | Project list improvements | ✅ Complete | April 2026 |
| Phase 4 | Enhanced workflows (partial) | ✅ Complete (items 10–11) | April 2026 |

### Phase 4 remaining backlog (items 12–13)
- **Project templates** — pre-populate kind, sections, and default voice on creation
- **Client/owner field** — project metadata for multi-client workflows

---

---

## Executive Summary

The Projects section is functionally capable but architecturally fragmented. Every action (Settings, Dicts, Timeline, Cast, Review, Export, Prep, Import) opens a separate modal or inline panel that displaces the project content below it. The result is a flat toolbar with 10 buttons that has no hierarchy, provides no spatial orientation, and forces users to memorise which action lives where.

The goal of this refactor is to redesign Projects as a **professional production workspace** — a persistent, panel-based shell similar to a DAW (Digital Audio Workstation) or screenwriting tool — where the script, cast, review, and timeline live side-by-side rather than stacked/hidden behind modals.

---

## Current State: Issues Found

### 1. Flat 10-button toolbar with no grouping
**Observed:** Settings · Dicts · Timeline · Cast · Review · Export · Prep · Import text · Render all · Archive  
**Problem:** No visual grouping, no hierarchy, no indication of workflow phase. A first-time user has no idea in what order to use these. Settings and Archive are destructive/configuration actions mixed in with primary workflow actions (Cast, Review, Export).  
**Severity:** High — blocks efficient onboarding and daily use

### 2. Stats bar doesn't update after add section/segment
**Observed:** SECTIONS: 0 / SEGMENTS: 0 / DRAFT: 0 persists even after a section was successfully created (toast fired) and a segment was added (toast fired).  
**Problem:** The stats bar counts are derived from the `sections` and `segments` state arrays, but after `createProjectSection` resolves, `setSections` is not immediately called with the new data — `loadProjectContents` would need to be re-called, or an optimistic update is missing.  
**Severity:** High — feedback gap makes users think their actions failed

### 3. Add section creates "Unsectioned" instead of named section
**Observed:** After typing "Chapter 1" and pressing Enter in the "Section title" input, the segment creation form appears under label "UNSECTIONED" — not "Chapter 1".  
**Problem:** Either (a) the section API call is succeeding but `sections` state isn't updated before the UI renders the segment form, or (b) the section wasn't created. The absence of "Chapter 1" in the section list confirms the state update gap.  
**Severity:** High — core workflow is broken visually

### 4. Review Mode takes over the full viewport
**Observed:** Clicking "Review" opens a full-screen modal that completely obscures the sidebar, project list, and toolbar. The left sidebar (segment list) is inside the modal but reuses a narrow fixed column.  
**Problem:** Users lose all project context. The review transport (Approve/Flag, Play) is functional but isolated. Should be a panel within the workspace, not a takeover.  
**Severity:** Medium — usable but disorienting

### 5. Timeline panel renders under/alongside the stats + segment list
**Observed:** The Timeline panel ("TIMELINE REVIEW") renders as a block above the stats bar and segment list — both are visible at the same time, creating duplicate layout.  
**Problem:** The timeline + the segments list are two views of the same data; showing both simultaneously wastes space and causes confusion about which is the "source of truth" for ordering.  
**Severity:** Medium — layout confusion

### 6. Cast button opens AI Casting Director (wrong)
**Observed:** Clicking "Cast" opens a dialog titled "AI Casting Director" — which is the global voice-finding tool, not a project cast management panel.  
**Problem:** "Cast" in a production workflow implies "manage who plays each character in this project", not "find me a new voice". The project already has a CastBoard component but it's triggered separately. The naming is misleading.  
**Severity:** Medium — misleads users expecting per-project character assignment

### 7. Export dialog is minimal — no per-segment selection
**Observed:** Export dialog has only a "Finishing Profile" dropdown (No finishing profile / Audiobook / Podcast / etc.) and a single "Start Export" button.  
**Problem:** No ability to export a subset of segments, no indication of how many audio files will be exported, no output path shown, no format selection (WAV / MP3 / FLAC).  
**Severity:** Medium — insufficient for professional use cases

### 8. Project creation UX is poor
**Observed:** The sidebar has a "New project title" text input + kind dropdown + "+" button. The kind defaults to "Audiobook" regardless of previous selection. There's no description field, no client/owner field, no template selection.  
**Problem:** Feels like a bare minimum form. Users working for multiple clients or running multiple projects of different types need better organisation from the start.  
**Severity:** Low-Medium

### 9. Archived projects are mixed into the active list
**Observed:** "test" (active) and "Securiti-Presentation" (archived) both appear in the same sidebar list, distinguished only by a grey "archived" badge. Archive button is disabled on the archived project.  
**Problem:** Archived projects pollute the working list. No unarchive button is visible. No delete option exists.  
**Severity:** Low-Medium

### 10. No breadcrumb or progress indicator for the production workflow
**Observed:** A project can go through: Prep → Script → Cast → Render → Review → Export. But there's no visual indication of what stage a project is at.  
**Problem:** Users working across multiple projects can't quickly see which ones need review vs which are ready to export.  
**Severity:** Low-Medium

### 11. "Quick Script" button in header still confusing
**Observed:** The Projects header still has a "Quick Script" (formerly "Script Reader") button that opens an embedded ScriptReaderModal inside the workspace — even though Script Reader is now a dedicated top-level nav section.  
**Problem:** The embedded quick-tool creates a third way to access script reading (nav → Script Reader, Projects header → Quick Script, inline per-segment preview). Consolidating is better.  
**Severity:** Low (cosmetic after rename)

### 12. Settings opens a large "Production Settings" dialog (not project-specific)
**Observed:** Settings opens a 7-tab dialog: Keys, Render, Export, Dicts, QC, Storage, Appearance. These are **global** settings, not project-specific.  
**Problem:** Calling it "Settings" in a project toolbar implies project settings. Global settings should be accessed from the sidebar/global Settings button, not per-project toolbar.  
**Severity:** Low-Medium

---

## Proposed Architecture: Panel-Based Workspace

Replace the flat toolbar model with a **persistent 3-panel workspace** that mirrors professional production tools.

```
┌─────────────────────────────────────────────────────────────────────┐
│  PROJECTS  [project kind badge]   [status pill]    [Quick Script ▼] │  ← persistent header
│  Project Title                    [Stage: Scripting → Review → Export]│
├──────────────────┬──────────────────────────────────────────────────┤
│ PROJECT LIST     │  MAIN CONTENT AREA  (switches per left-tab)      │
│  ┌─ New project  │                                                   │
│  │  + create     │  [Script] [Cast] [Review] [Export]  ← content tabs│
│  ├─ test  ●      │                                                   │
│  │  2 sections   │  (Sections & Segments / CastBoard /               │
│  ├─ Securiti †   │   TimelineReview / ExportDialog)                  │
│  │  0 sections   │                                                   │
│  ├─ ── archived  │                                                   │
│  └─ Show archived│                                                   │
├──────────────────┴──────────────────────────────────────────────────┤
│  STATS BAR: 3 Sections  ·  12 Segments  ·  4 Draft  ·  8 Rendered  │
└─────────────────────────────────────────────────────────────────────┘
```

### Content Tabs (inside the main panel)

| Tab | Current equivalent | Description |
|-----|-------------------|----|
| **Script** | Main segment list + Add section/segment | Editable script with sections, segments, per-segment voice/cast assignment. Inline add forms stay — but stats update optimistically. |
| **Cast** | CastBoard (currently buried) | Per-character voice assignment, not the AI Casting Director |
| **Review** | ReviewMode (full-screen modal → becomes inline panel) | Transport controls + approve/flag occupy the right 1/3 of the content area, segment list on the left |
| **Timeline** | TimelineReview | Timeline waveform + stitched export preview |
| **Export** | ExportDialog | Enhanced export with format, output path, segment selection |

### Toolbar → Action Menu Consolidation

Move the 10-button flat toolbar into two groups:

**Primary actions** (shown as prominent buttons, always visible):
- `Prep` (AI Script Prep) — only shown when Script tab is active
- `Import text` — only shown when Script tab is active  
- `Render all` — always visible with progress indicator

**Secondary actions** (collapsed into a `⋯ More` dropdown):
- `Dicts`
- `Archive`

**Moved out of Projects toolbar entirely:**
- `Settings` → global Settings sidebar item (already exists)
- `Cast (AI)` → AI Casting button (top of sidebar, already exists)

### Project List Improvements
- Default filter: show only `active` projects
- Toggle: "Show archived (N)" collapsed at bottom
- Per-project context menu (⋯): Rename, Duplicate, Archive/Unarchive, Delete
- Show segment count + render progress per project in the sidebar

### Production Stage Indicator
Add a horizontal progress trail below the project title:
```
Prep → Scripting → Casting → Rendering [3/12] → Review [0/12] → Ready to Export
```
Each stage lights up based on actual data (e.g. "Rendering" turns active when draft count > 0).

---

## Implementation Priority

### Phase 1 — Fix the bugs ✅ COMPLETE
1. ✅ **Fix stats not updating** — optimistic updates added to `handleAddSection` and `handleAddSegment`; `sections` and `segments` state updated immediately before API resolves
2. ✅ **Fix "Unsectioned" after section add** — `setSections` now includes the new section object before clearing `showAddSection`
3. ✅ **Move Cast button to CastBoard** — "Cast" toolbar button now opens `CastBoard` (per-project character assignment), not `VoiceFinder` (AI global voice search)

### Phase 2 — Navigation restructure ✅ COMPLETE
4. ✅ **Content tabs added** — Script / Cast / Review / Timeline / Export tabs inside the workspace main area, replacing the flat toolbar
5. ✅ **Toolbar restructured** — Render all, Prep (context-sensitive on Script tab), Import text remain; Settings + Archive moved to `⋯ More` dropdown
6. ✅ **Inline Review** — `ReviewMode` now accepts `inline` prop; rendered as an embedded panel within the Review tab instead of a full-screen modal takeover

### Phase 3 — Project list improvements ✅ COMPLETE
7. ✅ **Filter archived** — archived projects hidden by default; "Show archived (N)" collapse toggle at bottom of sidebar
8. ✅ **Per-project context menu** — `⋯` button per project opens menu with: Rename (inline form), Archive / Unarchive. Dismiss on outside click (bubble-phase listener with menu-target guard to prevent conflict with inline rename).
9. ✅ **Show counts** — segment count badge (`N seg`) shown in sidebar project item

### Phase 4 — Enhanced workflows (partial) ✅ ITEMS 10–11 COMPLETE
10. ✅ **Production stage indicator** — horizontal pill trail below project title: `Scripted [N segs] → Cast [N] → Rendered [N/N] → Reviewed [N/N] → Export ready`. Each pill color-coded: green (done), accent (in-progress), muted (not started). Shown only when segments exist.
11. ✅ **Export enhancements** — `ExportDialog` enhanced with:
    - **Segment scope summary card** — shows `N of N segments have audio` with amber/zinc/green color based on readiness; contextual advice message
    - **Prior exports list** — loads up to 3 most recent completed exports via `listExports()` on mount; each shows timestamp + individual Download button
    - **Props wired** — `totalSegments` and `renderedSegments` passed from `ProjectWorkspace` to `ExportDialog`
12. ⏳ **Project templates** — not yet implemented
13. ⏳ **Client/owner field** — not yet implemented

---

## Files Changed

| File | Change | Status |
|------|--------|--------|
| `components/ProjectWorkspace.tsx` | Major — added content tabs, optimistic state updates, restructured toolbar, context menu, rename/archive, production stage indicator | ✅ Done |
| `components/ReviewMode.tsx` | Added `inline` prop; renders as embedded panel when inline=true | ✅ Done |
| `components/ExportDialog.tsx` | Added `totalSegments`/`renderedSegments` props, segment scope summary card, prior exports list | ✅ Done |
| `components/CastBoard.tsx` | Minor — verified works as embedded tab panel | ✅ Done |
| `components/TimelineReview.tsx` | Minor — verified works as tab panel | ✅ Done |
| `components/SectionBlock.tsx` | No change needed — optimistic updates handled in parent | — |
| `components/SegmentRow.tsx` | No change needed — optimistic updates handled in parent | — |

---

## Design Principles for Refactor

1. **No full-screen takeovers** for sub-workflow tools — use tabs or split panes instead
2. **Optimistic state updates** — UI updates immediately on save; rollback on error
3. **Context-sensitive toolbar** — show only actions relevant to the current tab
4. **One path to each tool** — eliminate duplication (Quick Script, Cast (AI), Settings all have better homes)
5. **Spatial orientation** — users should always know where they are in the production workflow
6. **Progressive disclosure** — new users see Script tab by default; Cast/Review/Timeline/Export unlock as they add content
