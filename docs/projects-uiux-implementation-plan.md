# Projects UI/UX Implementation Plan

## Accuracy Review

The recommendations in `docs/projects-uiux-review.md` are accurate against the current code and Playwright artifacts.

Confirmed items:

- `ProjectListPanel` uses a compact icon-only desktop `New project` control and an inline `NewProjectSheet`.
- Project cards can clip client names and compress segment/QC metadata into small badges.
- Searching can hide the selected project while the main pane still shows that selected project.
- Mobile tabs use a fixed five-column grid, so `Timeline` can truncate.
- `ProjectImportPanel` has no Escape handler and its close icon has no explicit `aria-label`.
- `ProjectSettingsDrawer` renders a drawer close button, while `ProjectSettingsPanel` also renders an inner `X` close button and a `Cancel` action.
- `ExportDialog` renders as a centered `max-w-md` card in inline mode, leaving a lot of unused workspace width.
- The Tailwind CDN warning is expected because `index.html` loads `https://cdn.tailwindcss.com`.

No corrections were needed in the review file.

## Goals

1. Make project state and next action obvious within 3 seconds of opening Projects.
2. Make the project list feel like a production workspace index rather than a compact picker.
3. Replace the inline new-project form with a guided, template-driven create flow.
4. Improve mobile tab/action/sheet behavior without introducing horizontal overflow.
5. Move the visual system toward a cohesive paid SaaS product: clearer hierarchy, fewer nested cards, consistent actions, and polished states.

## Non-Goals

- Do not redesign Voices, Presets, Script Reader, or History in this pass.
- Do not change backend API contracts unless noted as an optional enhancement.
- Do not replace the existing Projects data model.
- Do not remove existing workflows while redesigning their presentation.

## Implementation Status

Last updated: 2026-04-30

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0: Baseline and Guardrails | Completed | Existing Projects Playwright suite is green. Added reusable `npm run projects:ui-audit` audit script with desktop/tablet/mobile screenshots and overflow checks. |
| Phase 1: Quick UX and Accessibility Fixes | Completed | Import sheet Escape/labels/focus, desktop New label, AI prep label, mobile safe-area padding, and local Tailwind build pipeline are implemented. |
| Phase 2: Project Health and Next Action | Completed | Added shared project health model, header health strip, next-action routing, and readiness-derived counts. |
| Phase 3: Project List Index Polish | Completed | Split list toolbar/row/progress/filter helpers, added saved views, richer row metadata, progress meter, search/sort, and hidden-current-project banner. |
| Phase 4: Guided New Project Flow | Completed | New project state is lifted to `ProjectWorkspace`; template-driven desktop drawer/mobile sheet creates projects and supports create-and-import. |
| Phase 5: Mobile Projects Polish | Completed | Mobile tabs scroll horizontally with stable widths, project switcher is sticky, and the fixed action bar reserves safe-area-aware content space. |
| Phase 6: Export Page Redesign | Completed | Inline export now uses the workspace width with package summary/readiness cards and preserved modal behavior for non-inline use. |
| Phase 7: Settings Drawer Simplification | Completed | Drawer has one header close affordance, grouped settings, dirty-state save disabling, and dirty-close confirmation. |
| Phase 8: Visual System Cleanup | Completed | Added SaaS utility classes, simplified stats strip, standardized semantic colors/actions, and moved project title to sans bold. |
| Phase 9: Documentation and QA | Completed | Updated `docs/projects.md`; verified with build, full Projects Playwright suite, and UI audit screenshots in `output/playwright/projects-ui-audit/`. |

## Phase 0: Baseline and Guardrails

Purpose: lock the current behavior before UI changes.

Files:

- `tests/projects/projects.spec.ts`
- `output/playwright/projects-ui-review/projects-ui-review.mjs` or a cleaned script under `scripts/`
- `docs/projects-uiux-review.md`

Implementation:

- Keep the existing Projects Playwright tests as the regression baseline.
- Add one lightweight UI audit script or test that checks:
  - desktop Projects overview has no horizontal overflow
  - mobile Projects overview has no horizontal overflow
  - mobile import sheet closes with Escape
  - mobile tab labels do not truncate in the 390px viewport
- Move the temporary Playwright audit script from `output/playwright/` to `scripts/projects-ui-audit.mjs` if it will be reused. Otherwise leave generated artifacts out of future commits.

Acceptance criteria:

- `npx playwright test tests/projects/projects.spec.ts --project=chromium --workers=1` passes.
- The UI audit produces screenshots for desktop overview, mobile overview, import sheet, and export tab.

## Phase 1: Quick UX and Accessibility Fixes

Purpose: address low-risk items that immediately improve polish.

### 1.1 Import Sheet Escape and Close Label

Files:

- `components/ProjectImportPanel.tsx`
- `tests/projects/projects.spec.ts`

Implementation:

- Add `useEffect` to `ProjectImportPanel`:
  - only attach the keydown listener when `mobile === true`
  - call `onClose()` when `event.key === 'Escape'`
  - do not intercept Escape for non-mobile inline import unless desired
- Add `aria-label="Close import sheet"` to the top-right `X` button.
- Ensure focus moves into the dialog on open:
  - add `useRef<HTMLDivElement>(null)`
  - add `tabIndex={-1}` to the mobile dialog root
  - call `dialogRef.current?.focus()` after mobile open

Tests:

- Add a Playwright test:
  - open mobile Projects
  - click `Import`
  - verify dialog is visible
  - press Escape
  - verify dialog is hidden

### 1.2 Label Desktop New Project

Files:

- `components/projects/ProjectListPanel.tsx`

Implementation:

- Replace the desktop icon-only new-project button with a labeled button when there is enough width:
  - use `hidden xl:inline-flex` text label or make the whole button `w-auto px-2.5 gap-1.5`
  - keep a compact icon-only fallback for mobile switcher or constrained contexts
- Recommended label: `New`.
- Keep `aria-label` as `New project`.

Tests:

- Update existing test expectation if needed. It currently uses role/name and should continue to pass.

### 1.3 Rename `Prep` to `AI prep`

Files:

- `components/projects/ProjectActionBar.tsx`
- `tests/projects/projects.spec.ts`

Implementation:

- Change visible desktop label from `Prep` to `AI prep`.
- Keep tooltip/title as `AI script prep`.
- Update test from `/prep/i` to `/AI prep|prep/i` or exact `AI prep`.

### 1.4 Mobile Bottom Padding

Files:

- `components/ProjectWorkspace.tsx`
- `components/projects/ProjectActionBar.tsx`
- `components/ExportDialog.tsx`

Implementation:

- Increase phone `main` bottom padding from `pb-28` to a safe-area-aware value:
  - class: `pb-36`
  - style: `paddingBottom: 'calc(9rem + env(safe-area-inset-bottom))'`
- On inline export content, ensure the final action area has enough bottom margin on phone.
- Keep the sticky action bar height stable.

Tests:

- Add a mobile assertion that Export tab primary content is not obscured by bottom nav/action bar.

### 1.5 Remove Production Tailwind CDN Warning

Files:

- `index.html`
- `package.json`
- `postcss.config.*` or `tailwind.config.*`
- `index.css`
- `index.tsx`

Implementation:

- Install Tailwind as a build dependency path:
  - `tailwindcss`
  - `postcss`
  - `autoprefixer`
- Move the inline Tailwind config from `index.html` into `tailwind.config.js`.
- Move reusable inline CSS from `index.html` into `index.css`.
- Import `index.css` from `index.tsx`.
- Remove the CDN script and inline `tailwind.config` block from `index.html`.

Tests:

- `npm run build`
- Launch Vite/preview and verify the console warning is gone.

## Phase 2: Project Health and Next Action

Purpose: make status, blockers, and the next useful action visible in the header.

### 2.1 Shared Project Health Model

New file:

- `components/projects/projectHealth.ts`

Implementation:

- Create a pure helper that consumes:
  - `project`
  - `segments`
  - `castProfiles`
  - `qcIssues`
  - `renderedCount`
  - `approvedCount`
  - `draftCount`
  - optional `exportProfileSelected`
- Reuse `getExportReadiness` from `components/projects/exportReadiness.ts`.
- Return:

```ts
export type ProjectHealthStatus = 'empty' | 'needs_script' | 'needs_cast' | 'needs_render' | 'needs_review' | 'blocked_qc' | 'ready_export';

export type ProjectNextAction =
  | { id: 'import_script'; label: 'Import script'; tab: 'script' }
  | { id: 'render_missing'; label: 'Render missing audio'; tab: 'script' }
  | { id: 'review_takes'; label: 'Review takes'; tab: 'review' }
  | { id: 'resolve_qc'; label: 'Resolve QC'; tab: 'review' }
  | { id: 'start_export'; label: 'Start export'; tab: 'export' };
```

- Include detail counts:
  - `segmentCount`
  - `renderedCount`
  - `approvedCount`
  - `openQcCount`
  - `missingAudioCount`
  - `draftCount`

### 2.2 Header Health Component

New file:

- `components/projects/ProjectHealthStrip.tsx`

Implementation:

- Render a compact status row below the project title:
  - status chip
  - rendered/approved progress
  - open QC count
  - next-action button
- Use one primary status color at a time:
  - amber for blocked/incomplete
  - emerald for ready
  - accent for in-progress
  - zinc for empty
- The next-action button should call a parent callback.

### 2.3 Wire Health Into Workspace

Files:

- `components/ProjectWorkspace.tsx`
- `components/projects/ProjectHeader.tsx`
- `components/projects/ProjectActionBar.tsx`

Implementation:

- Compute `projectHealth` in `ProjectWorkspace` after derived counts.
- Add `onProjectNextAction(action)` in `ProjectWorkspace`:
  - `import_script`: set active tab `script`, set `showImport(true)`
  - `render_missing`: call `handleRenderMissingAudio`
  - `review_takes`: set active tab `review`
  - `resolve_qc`: set active tab `review`, optionally set review filter if that is exposed later
  - `start_export`: set active tab `export`
- Pass health into `ProjectHeader`.
- Keep `ProjectHeader` presentational.

Tests:

- Add tests for a project with:
  - no segments: next action is import script or add script
  - draft segment: next action is render missing audio
  - rendered but unapproved audio: next action is review takes
  - open QC: next action is resolve QC
  - all approved/no QC: next action is start export

## Phase 3: Project List Index Polish

Purpose: make the project list scan well for many projects and client workflows.

### 3.1 Split Project List Internals

New files:

- `components/projects/ProjectListToolbar.tsx`
- `components/projects/ProjectListRow.tsx`
- `components/projects/ProjectProgressMeter.tsx`
- `components/projects/projectListFilters.ts`

Existing file:

- `components/projects/ProjectListPanel.tsx`

Implementation:

- Keep `ProjectListPanel` as the container.
- Move search/sort/new/view controls into `ProjectListToolbar`.
- Move each project card into `ProjectListRow`.
- Add helper functions for:
  - active/archived filtering
  - text search
  - saved views
  - sort options

### 3.2 Saved Views

Implementation:

- Add local state:

```ts
type ProjectView = 'active' | 'needs_review' | 'blocked' | 'recent' | 'archived';
```

- View definitions:
  - `active`: non-archived projects
  - `needs_review`: rendered count > approved count
  - `blocked`: open QC count > 0 or draft/missing audio exists
  - `recent`: non-archived sorted by updated desc
  - `archived`: archived projects
- Render as a compact segmented control above search on desktop and inside the mobile switcher.

### 3.3 Better Row Metadata

Implementation:

- Replace circular count badges with:
  - small rectangular `3 seg`
  - `1 QC`
  - `2/3 rendered`
- Add a thin progress meter:
  - width = rendered segments / total segments
  - color amber if QC exists, accent if in progress, emerald if ready
- Show client name on its own line when present.
- Show `Updated Apr 29` when `updated_at` exists.

### 3.4 Hidden Active Project During Search

Implementation:

- If `selectedProjectId` is not in the filtered visible list, show a slim banner:
  - `Current project is hidden by search`
  - buttons: `Clear search`, `Keep browsing`
- Do not automatically change the selected project just because search changed.

Tests:

- Search filters list.
- Active hidden banner appears when selected project is filtered out.
- Clearing search restores selected project row.
- Saved view filters show expected rows.

## Phase 4: Guided New Project Flow

Purpose: replace the cramped inline create form with a paid-SaaS create experience.

### 4.1 Lift New Project Open State

Files:

- `components/ProjectWorkspace.tsx`
- `components/projects/ProjectListPanel.tsx`

Implementation:

- Move `showNewProject` out of `ProjectListPanel` and into `ProjectWorkspace`.
- Add props to `ProjectListPanel`:

```ts
newProjectOpen: boolean;
onOpenNewProject: () => void;
onCloseNewProject: () => void;
```

- For Phase 4, the list button should call `onOpenNewProject` instead of expanding inline form.

### 4.2 Create New Project Drawer

New file:

- `components/projects/NewProjectDrawer.tsx`

Implementation:

- Render as:
  - right drawer on desktop
  - full-screen sheet on phone
- Use existing `PROJECT_TEMPLATES`.
- Template cards should show:
  - icon
  - label
  - description
  - default section count
  - kind
- Form fields:
  - project title
  - client
  - template
  - project description
  - advanced: kind, default voice, language, model
- Primary actions:
  - `Create project`
  - optional secondary `Create and import script`

### 4.3 Preserve Existing Create Logic

Files:

- `components/ProjectWorkspace.tsx`
- `components/projects/NewProjectDrawer.tsx`
- optional: `components/projects/useNewProjectForm.ts`

Implementation:

- Keep `handleCreateProject` in `ProjectWorkspace` initially.
- Make drawer submit call the existing handler.
- After successful create:
  - select created project
  - close drawer
  - if `Create and import script`, set active tab to `script` and `showImport(true)`
- Consider refactoring create state into a hook after the drawer works.

Tests:

- Opening New Project shows drawer.
- Selecting a template updates kind and description.
- Creating a project posts to `/api/projects`.
- Create and import opens import sheet/panel.
- Escape closes drawer without creating.

## Phase 5: Mobile Projects Polish

Purpose: improve small-screen usability while retaining the current responsive structure.

### 5.1 Tab Bar

Files:

- `components/ProjectWorkspace.tsx`

Implementation:

- Replace fixed `grid-cols-5` with horizontal scroll:

```tsx
<nav className="flex gap-1 overflow-x-auto rounded-lg border ...">
```

- Give each tab a stable minimum width:
  - `min-w-[5.5rem]`
  - use `whitespace-nowrap`
- Keep icons and labels visible.
- Add scroll padding so first/last tabs are not flush with edges.

Tests:

- In 390px viewport, `Timeline` is fully visible after scroll or no longer truncates.
- No horizontal document overflow.

### 5.2 Sticky Action Bar

Files:

- `components/projects/ProjectActionBar.tsx`
- `components/ProjectWorkspace.tsx`

Implementation:

- Keep it fixed on phone, but reserve space in the content pane.
- Use `bottom-[calc(3.5rem+env(safe-area-inset-bottom))]` instead of hardcoded `bottom-14` if needed.
- Add stronger separation:
  - `shadow-[0_-8px_24px_rgba(15,23,42,0.08)]`
  - top border
  - background opacity `bg-white/98`
- Ensure overflow menu bottom position is derived from action bar height.

### 5.3 Compact Mobile Header on Scroll

Files:

- `components/ProjectWorkspace.tsx`
- `components/projects/MobileProjectSwitcher.tsx`
- `components/projects/ProjectHeader.tsx`

Implementation:

- Add a CSS-only sticky compact area, or a small hook that tracks main scroll.
- When scrolled past the header:
  - keep project switcher and current blocker/next action visible
  - hide verbose default voice/client copy
- Avoid layout jumps by reserving header height.

Tests:

- Scroll mobile script tab; sticky actions remain usable.
- No content is hidden behind bottom controls.

## Phase 6: Export Page Redesign

Purpose: turn Export from a small card into a complete workflow page.

Files:

- `components/ExportDialog.tsx`
- `components/projects/ExportReadinessChecklist.tsx`
- optional new file: `components/projects/ExportPackagePreview.tsx`
- optional new file: `components/projects/ExportHistoryList.tsx`

Implementation:

- When `inline === true`, render a full-width page section instead of `max-w-md`.
- Suggested layout:
  - left/main: profile picker, package name, package contents, export format
  - right/aside: readiness checklist and recent exports
- Keep modal behavior for non-inline mode.
- Split current `ExportDialog` into smaller presentational pieces:
  - `ExportReadinessChecklist`
  - `ExportProfileSection`
  - `ExportJobStatus`
  - `ExportHistoryList`
- Make blockers actionable:
  - missing audio: `Render missing`
  - open QC: `Review QC`
  - unapproved rendered audio: `Go to Review`
- Use the same `projectHealth` helper from Phase 2.

Tests:

- Export tab shows readiness checklist.
- Disabled `Start Export` has a visible reason.
- Clicking blocker actions changes tab or starts render.
- Recent exports still show when API returns completed jobs.

## Phase 7: Settings Drawer Simplification

Purpose: remove duplicated close affordances and make settings feel deliberate.

Files:

- `components/projects/ProjectSettingsDrawer.tsx`
- `components/ProjectSettingsPanel.tsx`

Implementation:

- Add prop to `ProjectSettingsPanel`:

```ts
showHeaderClose?: boolean;
```

- In drawer usage, pass `showHeaderClose={false}`.
- In standalone usage, keep default `true`.
- Group fields with section headings:
  - `Voice defaults`
  - `Language and model`
  - `Performance style`
- Track dirty state in `ProjectWorkspace`:
  - compare settings fields to selected project fields
  - disable `Save settings` when not dirty
  - if dirty and user closes, show confirm prompt or inline warning

Tests:

- Drawer has one close button plus Cancel/Save.
- Escape closes drawer when not dirty.
- Dirty close prompts or prevents accidental close.
- Save disabled until a value changes.

## Phase 8: Visual System Cleanup

Purpose: make Projects look cohesive without rewriting the app.

Files:

- `index.css`
- `components/projects/*`
- `components/ProjectStatsBar.tsx`
- `components/SectionBlock.tsx`
- `components/SegmentRow.tsx`
- `components/ReviewMode.tsx`
- `components/TimelineReview.tsx`
- `components/ExportDialog.tsx`

Implementation:

- Add project-local utility classes in `index.css`:

```css
.saas-card { border: 1px solid var(--border); border-radius: 8px; background: var(--surface); }
.saas-section { border-top: 1px solid var(--border); }
.saas-muted { color: var(--muted); }
```

- Prefer 8px radius for cards and controls.
- Reduce nested card borders:
  - stats strip should be one section, not three equal heavyweight cards
  - segment rows can use section dividers and hover states instead of full card borders everywhere
- Standardize button styles:
  - primary: dark/accent filled
  - secondary: neutral border
  - destructive: red text or red subtle background
- Replace `font-serif` project title in `ProjectHeader` with sans unless the design direction intentionally reserves serif for editorial text.
- Keep status colors semantic and limited:
  - green: complete/approved/ready
  - amber: needs attention/warning
  - red: destructive/error
  - accent: selected/current/in progress

Tests:

- Visual screenshot comparison by manual review or Playwright screenshots.
- No text overlap or truncation regressions in desktop 1440px and mobile 390px.

## Phase 9: Documentation and QA

Files:

- `docs/projects.md`
- `docs/projects-uiux-review.md`
- `docs/projects-uiux-implementation-plan.md`
- `tests/projects/projects.spec.ts`

Implementation:

- Update `docs/projects.md` after phases land:
  - new project drawer
  - project health strip
  - saved project views
  - export page
- Keep `projects-uiux-review.md` as historical review notes.
- Add screenshots from the final UI pass into `output/playwright/` for manual review.

Verification:

- `npm run build`
- `npx playwright test tests/projects/projects.spec.ts --project=chromium --workers=1`
- Manual browser pass:
  - desktop 1440 x 960
  - tablet 768 x 1024
  - phone 390 x 844
  - light and dark themes

Completed verification:

- `npm run build` passed on 2026-04-30. Vite reports the existing large bundle-size warning.
- `npx playwright test tests/projects/projects.spec.ts --project=chromium --workers=1` passed on 2026-04-30 with 34/34 tests passing.
- `npm run projects:ui-audit` passed on 2026-04-30 against `http://localhost:4173` and produced desktop, tablet, mobile overview, mobile import sheet, and mobile export screenshots in `output/playwright/projects-ui-audit/`.

## Recommended Delivery Order

1. Phase 1 quick fixes.
2. Phase 2 project health and next action.
3. Phase 3 project list polish.
4. Phase 4 new project drawer.
5. Phase 5 mobile polish.
6. Phase 6 export page redesign.
7. Phase 7 settings cleanup.
8. Phase 8 visual system cleanup.
9. Phase 9 docs and QA.

This order keeps risk controlled: accessibility and spacing fixes first, shared state derivation second, then larger presentation changes once the app has a reliable health model to drive the redesigned surfaces.
