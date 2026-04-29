# Projects UI/UX Enhancements Plan

> Audit date: April 28, 2026  
> Audit method: Playwright walkthrough on production preview (`http://localhost:4100`) with Go API backend on `http://localhost:8080`  
> Viewports reviewed: desktop 1689x1285, mobile 390x844  
> Primary files: `components/ProjectWorkspace.tsx`, `ProjectImportPanel.tsx`, `ProjectSettingsPanel.tsx`, `CastBoard.tsx`, `ReviewMode.tsx`, `TimelineReview.tsx`, `ExportDialog.tsx`, `NavigationSidebar.tsx`

## Executive Summary

The Projects feature is now a real production workspace: projects can be created, text can be imported into sections and segments, project progress is summarized, and Cast, Review, Timeline, and Export are reachable from one place. The next quality step is not adding more surface area. It is making the existing surface feel like a single professional workflow instead of a collection of embedded tools.

The biggest UX issue is fragmentation. Several panels still behave like former modals or separate tools inside a tabbed workspace. Cast has a "Close cast board" button, Review has "Close review mode," and Export has "Close export dialog." On mobile, this fragmentation becomes more severe because there are two bottom navigation bars, icon-only workspace tabs, clipped status text, and content hidden under fixed navigation.

The plan below focuses on making Projects feel reliable, coherent, and production-ready: clear project setup, a more useful project list, workflow-aware action bars, better render/export readiness, and a mobile layout that prioritizes one task at a time.

## Current Strengths

- Project creation is fast and works without leaving the workspace.
- Imported Markdown produced expected sections and segments in production preview.
- The project header now includes useful progress context: script count, render count, review state, and export readiness.
- Active and archived projects are separated with a collapsed archived section.
- The main workspace tabs cover the right professional workflow phases: Script, Cast, Review, Timeline, Export.
- Project cards now show segment count, which helps the project list feel less bare.

## Accuracy Review Notes

Reviewed against source on April 28, 2026. The plan is directionally accurate and maps to the current component structure.

- Confirmed: Cast, Review, and Export are rendered inside workspace tabs but still carry close-button/modal language through `onClose` callbacks.
- Confirmed: Review uses a nested `main` landmark when rendered inline.
- Confirmed: Export can still start when the project has zero rendered segments; the UI warns but does not block or explicitly switch to a render-then-export flow.
- Confirmed: mobile Projects currently shows global bottom navigation, project workspace bottom tabs, and the compact icon-only tab strip at the same time.
- Confirmed: project records already support `description`, `client_id`, and `metadata_json`, so Phase 3 does not require a new table for basic templates/client metadata.
- Clarification: the take list action is not a live recorder or renderer. The safer near-term label is "Add take" or "Add take metadata"; a true "Render take" action should call the existing render endpoint instead.
- Clarification: duplicate and hard delete project actions do not currently exist in the API. Phase 2 should either omit them from the first UI pass or add explicit backend endpoints with tests.

## Key Findings

### 1. Workspace Feels Assembled From Modals

Severity: High

Observed:
- Cast tab includes "Close cast board."
- Review tab includes "Close review mode."
- Export tab includes "Close export dialog" and is labeled as a dialog in the accessibility tree.
- Review introduces a nested `main` landmark inside the Projects page, creating multiple main regions.

Why it matters:
Users are already inside the Projects workspace. Close buttons imply these panels are temporary overlays, but they are presented as tabs. This weakens orientation and makes the feature feel less polished.

Enhancement:
- Convert Cast, Review, Timeline, and Export into true tab panels.
- Remove close buttons from tab content.
- Use one page-level `main` landmark and tabpanel regions for content.
- Keep tab state as the only way to switch workspace modes.

### 2. Project Creation Is Too Minimal For Professional Work

Severity: High

Observed:
- New project creation is a text field, kind dropdown, and icon-only create button inside the project list.
- There is no template, client, deadline, owner, description, target format, or default workflow setup.
- The create form consumes permanent space even after projects exist.

Why it matters:
Professional users need organization from the first step. The current form is fast, but it reads as a quick scratchpad rather than a production workspace.

Enhancement:
- Replace the always-visible form with a "New Project" button that opens a compact creation sheet.
- Include title, kind, template, client/brand, default voice/style, and optional description.
- Offer templates such as Audiobook Chapters, Voiceover Spot, Podcast Episode, Training Module, and Character Reel.
- Keep a one-line quick-create affordance only after the richer flow exists.

### 3. Project List Needs Management Tools

Severity: Medium-High

Observed:
- Active projects show title, kind, and segment count.
- Context menu offers only Rename and Archive.
- There is no search, sort, duplicate, pin/favorite, client grouping, or visible last updated timestamp.

Why it matters:
As project count grows, the left rail becomes a bottleneck. A professional workspace should help users find the right project and understand its state at a glance.

Enhancement:
- Add project search and sort controls.
- Add secondary metadata: updated time, client, stage, render progress, and review count.
- Expand project menu actions to Rename, Duplicate, Archive/Unarchive, Delete, and Export project metadata.
- Support pinned projects at the top.

### 4. Action Hierarchy Is Still Flat

Severity: Medium-High

Observed:
- Script tab actions are Prep, Import, Render all, and More.
- Project settings, dictionaries, and archive are hidden in More.
- Actions do not adapt enough to the active stage or readiness state.

Why it matters:
Projects has a natural workflow: set up, import/prep script, assign cast, render, review, export. The UI should reinforce that path and explain why actions are unavailable.

Enhancement:
- Make the toolbar tab-aware:
  - Script: Prep, Import, Add Section, Add Segment.
  - Cast: Add Character, Audition, Assign Missing Voices.
  - Review: Play, Approve, Flag, Open Issues.
  - Timeline: Preview, Stitch, Download.
  - Export: Select Profile, Start Export.
- Move project settings and dictionaries into a persistent project configuration panel.
- Add disabled-state reasons, especially for render/export actions.

### 5. Export Readiness Is Confusing

Severity: Medium-High

Observed:
- Timeline disables "Stitch & Export WAV" when no segments have audio.
- Export tab shows "0 of 3 segments have audio" and "Render segments first before exporting," but "Start Export" remains clickable.
- The Export UI still appears as a dialog even though it is a tab.

Why it matters:
Export is the final production step. It should be the most trustworthy part of the workflow and should never invite a user to start an export that cannot succeed.

Enhancement:
- Disable Start Export until required audio exists, or make it start a render-then-export job explicitly.
- Add an export readiness checklist:
  - Segments rendered
  - Takes approved
  - Open QC issues resolved or waived
  - Export profile selected
- Offer two clear flows: "Render missing audio" and "Export ready audio."

### 6. Script Editing And Segment Actions Need Clearer Affordances

Severity: Medium

Observed:
- Segment text appears as static text with status on the far right.
- Takes are hidden behind a full-width expander.
- Empty takes show "No takes yet" and "Record take," but the current form creates manual take metadata rather than recording or rendering audio.
- Add segment buttons appear within sections and again at the bottom.

Why it matters:
The script tab should be the main daily workspace. Users need obvious edit, assign voice, render, takes, and issue actions per segment without hunting.

Enhancement:
- Use a consistent segment row with visible actions on hover and keyboard focus:
  - Edit
  - Voice/Cast
  - Render
  - Takes
  - QC
  - More
- Rename "Record take" to "Add take" or "Add take metadata" for the current manual take form; reserve "Render take" for an action that calls TTS.
- Keep one primary add-segment affordance per section, plus a sticky add button for long scripts.
- Add an import preview showing sections/segments before writing to the project.

### 7. Project Settings Panel Is Too Large Inline

Severity: Medium

Observed:
- Project Settings opens inline above stats and pushes the script content far down.
- It includes many fields at once: voice, language, provider, model, fallback provider, fallback model, performance style.

Why it matters:
Settings are important but secondary. Pushing the script workspace down breaks continuity and makes the page feel jumpy.

Enhancement:
- Move project settings into a right-side drawer on desktop.
- Use sections for Voice Defaults, Provider Strategy, Performance Style, and Export Defaults.
- On mobile, use a full-screen sheet with save/cancel pinned at the bottom.

### 8. Mobile Layout Has Competing Navigation Systems

Severity: High

Observed at 390x844:
- Global bottom nav appears at the bottom.
- Project workspace bottom tabs appear above it.
- The main tab strip is also visible as icon-only tabs.
- Export content extends below the visible area and is covered by fixed navigation.
- The project progress trail clips horizontally; "Export ready" extends past the viewport.
- The project list and selected project content are stacked, leaving limited space for the active task.

Why it matters:
Projects is too dense to use two bottom navs and a tab strip at the same time. Users need a focused mobile task flow.

Enhancement:
- On mobile, show either global navigation or project navigation, not both at full weight.
- Convert project selection into a drawer or top dropdown once a project is selected.
- Replace icon-only top workspace tabs with a single segmented control or "View" dropdown.
- Keep one sticky project action bar per active workspace tab.
- Add bottom padding equal to all fixed bars so content never sits under navigation.
- Wrap or horizontally scroll the progress trail rather than clipping it.

### 9. Review Mode Is Useful But Too Isolated

Severity: Medium

Observed:
- Review has a strong transport layout, segment queue, approve/flag actions, and keyboard shortcuts.
- It has its own close button and nested layout.
- It shows shortcuts visibly inside the workflow.

Why it matters:
The review workflow is a core differentiator, but it should feel embedded in Projects rather than like a temporary mode.

Enhancement:
- Keep Review as a tab panel with no close button.
- Let the review queue reuse the same project segment model and status colors.
- Hide keyboard shortcut help behind a tooltip or help button to reduce visual noise.
- Add empty/blocked states when no rendered takes exist.

### 10. Operational Trust Issues Show Up During Review

Severity: Medium

Observed:
- Production preview logged a missing favicon.
- Tailwind CDN warning appears in console.
- The progress WebSocket timed out through Vite preview, and the Go-served embedded build previously returned a WebSocket handshake failure.
- The dev server path showed stale project data after import, while the production preview refreshed correctly.

Why it matters:
Projects relies on jobs, render progress, and export readiness. Progress transport issues directly affect user trust in long-running work.

Enhancement:
- Verify `/api/ws/progress` under both Go-served production and Vite dev/preview.
- Add a visible fallback state when live progress is disconnected.
- Add a favicon and remove CDN Tailwind from production builds.
- Add a regression test for project import refreshing section and segment counts.

## Proposed Target Experience

Desktop layout:

```text
Projects header
Project list | Project workspace
             | Title, metadata, stage trail
             | Workspace tabs: Script / Cast / Review / Timeline / Export
             | Tab-aware action bar
             | Active tab panel
```

Mobile layout:

```text
Projects header
Selected project dropdown
Stage summary
Active workspace view
Sticky tab action bar
One bottom navigation layer
```

Project stage model:

```text
Setup -> Scripted -> Cast Assigned -> Rendered -> Reviewed -> Export Ready
```

The stage trail should be data-backed, not manual:
- Setup complete: project has default voice or explicit provider defaults.
- Scripted: at least one segment exists.
- Cast assigned: all speaker/cast-required segments have voice or cast assignment.
- Rendered: all non-locked segments have current takes.
- Reviewed: all required takes approved or waived.
- Export ready: rendered and review gates pass.

## Phased Implementation Plan

Detailed implementation docs:
- Phase 1: `docs_internal/projects-uiux-phase-01-polish-trust.md`
- Phase 2: `docs_internal/projects-uiux-phase-02-workspace-shell.md`
- Phase 3: `docs_internal/projects-uiux-phase-03-creation-import-readiness.md`
- Phase 4: `docs_internal/projects-uiux-phase-04-mobile-redesign.md`

### Phase 1: Polish And Trust Fixes

Goal: Make the current workspace feel coherent without a large redesign.

Tasks:
- Remove modal-style close buttons from Cast, Review, and Export tab content.
- Replace nested `main` landmarks with tabpanel regions.
- Disable Start Export when audio is missing, or rename it to "Render then export" if that is intended.
- Add disabled-state helper text for Timeline and Export actions.
- Rename "Record take" to "Add take" or "Add take metadata" for the current manual take form.
- Fix mobile bottom padding so fixed navigation does not cover content.
- Add favicon and verify production console is clean aside from expected development warnings.
- Add a project import refresh regression check.

Acceptance criteria:
- No workspace tab contains a close button.
- Export cannot start silently when 0 segments have audio.
- Mobile content remains visible above fixed navigation.
- Importing text updates project stats without manual refresh.

### Phase 2: Workspace Shell Refinement

Goal: Clarify navigation and action hierarchy.

Tasks:
- Make the active workspace tab drive the action bar.
- Move Project Settings into a side drawer.
- Add a project search/sort row.
- Add project stage and updated-at metadata to project list items.
- Add Duplicate and Delete to project context menus with confirmations.
- Collapse the create-project form behind a "New Project" button.

Acceptance criteria:
- Primary actions change by tab and match the active task.
- Project list remains scannable with 10+ projects.
- New project creation no longer permanently consumes project-list space.

### Phase 3: Professional Creation, Import, And Readiness

Goal: Make Projects feel production-grade from setup through export.

Tasks:
- Add project creation templates.
- Add optional client/brand and description fields.
- Add import preview before committing sections and segments.
- Add export readiness checklist.
- Add "Render missing audio" from Export and Timeline.
- Add a project-level stage trail with data-backed status.

Acceptance criteria:
- A user can create a project with a useful template in under one minute.
- Import preview shows the exact section/segment split before save.
- Export clearly shows blockers and offers a direct fix action.

### Phase 4: Mobile Projects Redesign

Goal: Make Projects usable on a phone without competing navigation.

Tasks:
- Convert project list into a drawer or selected-project dropdown.
- Replace duplicate workspace tab controls with one mobile control.
- Use a bottom sheet for More actions and settings.
- Keep only the current task in the vertical flow.
- Add responsive tests for 390x844 and 430x932.

Acceptance criteria:
- One navigation model is visible for Projects at a time.
- The active task starts in the first viewport after selecting a project.
- No status trail or action button clips horizontally.

## Suggested File Touchpoints

- `components/ProjectWorkspace.tsx`: workspace shell, project list, action bar, mobile layout, tabpanel semantics.
- `components/ProjectImportPanel.tsx`: import preview, clearer copy, file import validation.
- `components/ProjectSettingsPanel.tsx`: move from inline block to drawer/sheet.
- `components/CastBoard.tsx`: remove close-board semantics when rendered inside Projects.
- `components/ReviewMode.tsx`: inline tab semantics, shortcut-help treatment, empty rendered-take states.
- `components/TimelineReview.tsx`: readiness copy, render-missing action, export disabled reasons.
- `components/ExportDialog.tsx`: convert from dialog mental model to export tab panel.
- `components/NavigationSidebar.tsx`: mobile nav coordination with project workspace nav.
- `components/JobProvider.tsx` and `api.ts`: progress connection fallback and disconnected state.

## Recommended Next Action

Start with Phase 1. It is low-risk, improves perceived quality immediately, and creates a cleaner base for the larger workspace changes. The most important first fixes are: remove modal-style close buttons from tab content, make Export readiness truthful, and clean up the mobile navigation overlap.
