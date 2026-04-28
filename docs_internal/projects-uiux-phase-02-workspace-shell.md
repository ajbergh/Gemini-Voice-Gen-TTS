# Projects UI/UX Phase 2 - Workspace Shell Refinement

> Parent plan: `docs_internal/projects-uiux-enhancements-plan.md`  
> Goal: clarify navigation, project management, and action hierarchy without redesigning creation/import/export workflows yet.

## Scope

Phase 2 turns the current large `ProjectWorkspace.tsx` surface into a cleaner workspace shell. It adds better project list controls, a tab-aware action bar, and a drawer-based project settings experience.

Out of scope:
- Template-based project creation.
- Import preview.
- Export readiness checklist beyond Phase 1.
- Full mobile redesign.
- Hard delete unless explicit backend support is added in this phase.

## Current Baseline

- `ProjectWorkspace.tsx` owns project list, create form, selected project header, stage trail, tab bar, action bar, settings, import, script, cast, review, timeline, and export rendering.
- The action bar is partially tab-aware: Script has Prep, Import, Render all; other tabs mostly rely on their embedded panel controls.
- Project settings are shown inline above stats and push script content down.
- Active project list items only show segment count for the selected project because counts come from the loaded selected project state.
- Context menu supports Rename and Archive for active projects, Unarchive for archived projects.
- Project records already support `description`, `client_id`, and `metadata_json`.

## Design Target

The workspace shell should have stable regions:

```text
Project list panel
Project detail shell
  Project header
  Stage trail
  Workspace tab bar
  Tab-aware action bar
  Active tab panel
  Optional side drawer
```

The shell should answer:
- Which project am I in?
- What stage is it in?
- What can I do right now?
- Where are project-level settings?
- How do I find another project?

## Implementation Slices

### 1. Extract Shell Subcomponents

Files:
- `components/ProjectWorkspace.tsx`
- New: `components/projects/ProjectListPanel.tsx`
- New: `components/projects/ProjectHeader.tsx`
- New: `components/projects/ProjectActionBar.tsx`
- New: `components/projects/ProjectStageTrail.tsx`

Steps:
1. Keep state ownership in `ProjectWorkspace.tsx` initially.
2. Extract presentation-only components first.
3. Pass callbacks and derived values down from `ProjectWorkspace`.
4. Avoid introducing global state or context in this phase.

Suggested boundaries:
- `ProjectListPanel`: create/search/sort/list/archive controls.
- `ProjectHeader`: kind/status/title/default voice/stage trail.
- `ProjectActionBar`: active tab actions and More menu.
- `ProjectStageTrail`: data-backed progress pills.

Acceptance criteria:
- `ProjectWorkspace.tsx` is meaningfully smaller.
- Behavior remains unchanged except for planned UX improvements.
- New components receive typed props and do not directly call APIs unless needed.

### 2. Add Project Search And Sort

Files:
- `ProjectWorkspace.tsx`
- `components/projects/ProjectListPanel.tsx`

State:
- `projectSearch: string`
- `projectSort: 'updated_desc' | 'created_desc' | 'title_asc' | 'kind_asc'`
- Optional: `showArchived: boolean` remains.

Steps:
1. Add a search input above active projects.
2. Filter by title, kind, description, and client display name if available.
3. Add a compact sort select or menu.
4. Keep archived projects collapsed by default.
5. Preserve keyboard access:
   - Search input has label or aria-label.
   - Project cards remain buttons.

Acceptance criteria:
- With 10+ projects, users can find a project by title without scrolling.
- Sorting is deterministic and does not mutate source `projects`.

### 3. Add Project List Metadata

Files:
- Frontend: `components/projects/ProjectListPanel.tsx`
- API: `api.ts`
- Backend optional: `backend/internal/store/projects.go`, `backend/internal/handler/api_projects.go`, `backend/internal/server/routes.go`

Problem:
The selected project can show a segment count because its contents are loaded. Other projects cannot show reliable counts without extra requests or a summary endpoint.

Preferred implementation:
1. Add a backend project summary endpoint:
   - `GET /api/projects/summary`
   - Returns one row per project with `project_id`, `section_count`, `segment_count`, `rendered_count`, `approved_count`, `open_qc_count`, `updated_at`.
2. Add store query using grouped joins.
3. Add frontend `listProjectSummaries()`.
4. Merge summaries by project id in the list panel.

Fallback implementation:
- Fetch section/segment counts lazily when a project card becomes visible or selected.
- Use a short-lived in-memory cache.

Acceptance criteria:
- Project list shows segment count for every loaded project, not only the selected one.
- Render/review readiness indicators are not stale after import/render/review actions.

### 4. Collapse Create Form Behind New Project

Files:
- `components/projects/ProjectListPanel.tsx`
- Optional new: `components/projects/NewProjectSheet.tsx`

Steps:
1. Replace the always-visible title/kind form with a "New Project" button.
2. Clicking opens a compact sheet/popover on desktop.
3. On mobile, use a full-width sheet.
4. Keep the fields from the current form in Phase 2:
   - title
   - kind
5. Do not add templates until Phase 3.
6. On create success:
   - prepend to list
   - select created project
   - close sheet
   - reset form

Acceptance criteria:
- Existing project list starts higher in the sidebar.
- New project creation remains fast.

### 5. Move Project Settings To A Drawer

Files:
- `components/ProjectSettingsPanel.tsx`
- New: `components/projects/ProjectSettingsDrawer.tsx`
- `components/ProjectWorkspace.tsx`

Steps:
1. Keep `ProjectSettingsPanel` as the form body where practical.
2. Wrap it in a desktop right drawer controlled by `showProjectSettings`.
3. Drawer should not push script content down.
4. Drawer should include:
   - Voice Defaults
   - Provider Strategy
   - Performance Style
   - Export Defaults placeholder if not implemented yet
5. Save and Cancel/Close should be sticky inside the drawer.
6. Mobile drawer behavior can remain simple in Phase 2; full redesign is Phase 4.

Acceptance criteria:
- Opening project settings preserves the user's scroll position in the active tab.
- Settings are clearly project-specific, not global app settings.

### 6. Implement Tab-Aware Action Bar

Files:
- `components/projects/ProjectActionBar.tsx`
- `components/ProjectWorkspace.tsx`
- Existing tab components as needed.

Pattern:
```ts
type ProjectAction = {
  id: string;
  label: string;
  icon: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  disabledReason?: string;
  onClick: () => void;
};
```

Actions by tab:
- Script: Prep, Import, Add Section, Add Segment, Render all.
- Cast: Add Character, Audition, Assign Missing Voices.
- Review: Play Selected, Approve, Flag, Add Issue.
- Timeline: Preview, Stitch, Download.
- Export: Start Export, Render Missing Audio, Export Profile.

Implementation notes:
- Start by moving existing actions into the action bar.
- Do not duplicate controls if a child panel already owns complex behavior; expose callbacks gradually.
- Keep destructive/project-level actions in More.

Acceptance criteria:
- The primary action changes when the active workspace tab changes.
- Disabled actions explain why they are disabled.
- More menu contains secondary project-level actions only.

### 7. Project Context Menu Expansion

Files:
- `ProjectListPanel.tsx`
- `api.ts`
- Backend files only if adding APIs.

Near-term safe actions:
- Rename
- Archive
- Unarchive

Optional Phase 2 actions requiring backend work:
- Duplicate
- Delete archived project

Duplicate implementation options:
1. Metadata-only duplicate:
   - Clone project row.
   - Do not copy sections, segments, takes, cast, dictionaries, styles.
2. Production duplicate:
   - Clone project row, sections, segments, cast profiles, dictionaries.
   - Do not copy rendered takes/audio by default.
   - Add option later to include takes.

Delete implementation guardrails:
- Prefer hard delete only for archived projects.
- Require confirmation with project title.
- Add store tests for cascading cleanup.

Acceptance criteria:
- Menu does not show actions that cannot work.
- Optional backend actions have tests before the UI exposes them.

## Test Plan

Run:
- `npm run build`
- `go test ./internal/store ./internal/handler ./internal/server` if backend endpoints are added

Manual checks:
- Project search and sorting with active and archived projects.
- New Project sheet on desktop and mobile.
- Project settings drawer open/close/save.
- Tab-aware action bar on every tab.
- No duplicate controls for the same primary action.

## Risks

- Extracting components from `ProjectWorkspace.tsx` can create prop churn. Keep behavior changes small per commit.
- Project summaries can become expensive if implemented with many joins. Add indexes only if query plans show need.
- Duplicate/delete can increase data-loss risk. Keep those behind confirmations and backend tests.

## Done Definition

Phase 2 is done when Projects has a stable shell, a searchable project list, a settings drawer, and a tab-aware action bar with no major workflow changes deferred into hidden child panels.
