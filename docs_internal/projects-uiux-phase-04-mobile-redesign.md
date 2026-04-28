# Projects UI/UX Phase 4 - Mobile Projects Redesign

> Parent plan: `docs_internal/projects-uiux-enhancements-plan.md`  
> Goal: make Projects usable on phones by reducing competing navigation and focusing each screen on one task.

## Scope

Phase 4 is a responsive UX pass for Projects. It assumes Phase 1 through Phase 3 have already clarified desktop shell behavior, action hierarchy, creation, import, and readiness.

Out of scope:
- New backend features.
- New project templates beyond Phase 3.
- Major desktop layout changes unless required to support shared components.

## Current Mobile Baseline

At 390x844, Projects currently shows:
- Global bottom navigation.
- Project workspace bottom tabs above global nav.
- Main workspace tab strip as icon-only tabs.
- Project list stacked above selected project content.
- Clipped stage trail text.
- Export content and actions extending behind fixed navigation.

This creates too many navigation layers and too little working space for the active task.

## Design Principles

- One primary navigation layer at a time.
- One active task per screen.
- Project switching should be available, but not permanently consume half the viewport.
- Workspace actions should be close to the content they affect.
- Fixed bars must reserve layout space so content is never hidden behind them.

## Target Mobile Structure

```text
Projects header
Selected project row
Stage summary
Active workspace view
Sticky action bar for current view
One bottom navigation layer
```

## Implementation Slices

### 1. Choose One Mobile Navigation Model

Files:
- `components/ProjectWorkspace.tsx`
- `components/NavigationSidebar.tsx`
- `components/useResponsiveMode.ts`

Recommended approach:
- Keep global bottom nav visible for top-level app navigation.
- Remove the separate project bottom tab bar.
- Replace project workspace tabs with a compact in-content segmented control or a "View" dropdown near the selected project row.

Alternative:
- When Projects is active, hide global bottom nav and use project-specific bottom tabs.
- This requires a top-level app prop from `App.tsx` to `NavigationSidebar`.

Preferred first implementation:
1. Delete or disable `renderMobileTabs()` for phone layouts.
2. Keep global app navigation.
3. Convert workspace tab selection to one compact control inside the Projects header/detail area.

Acceptance criteria:
- Mobile Projects shows one bottom navigation layer.
- Workspace tab selection remains reachable within the first viewport.

### 2. Convert Project List To Drawer Or Picker

Files:
- `components/ProjectWorkspace.tsx`
- `components/projects/ProjectListPanel.tsx`
- New: `components/projects/MobileProjectSwitcher.tsx`

Steps:
1. On phone, hide the full project list by default after a project is selected.
2. Show selected project as a button/dropdown row:
   - title
   - kind
   - stage summary
   - project switch icon
3. Tapping opens a project switcher sheet.
4. The sheet contains:
   - search
   - new project
   - active project list
   - archived toggle
5. Selecting a project closes the sheet and returns to the active workspace view.

Acceptance criteria:
- The selected project content starts near the top of the viewport.
- Users can still switch projects in two taps.
- Project search remains available on mobile.

### 3. Mobile Workspace View Control

Files:
- `components/ProjectWorkspace.tsx`
- New or extracted: `components/projects/WorkspaceViewControl.tsx`

Options:
1. Segmented scroll control:
   - Script
   - Cast
   - Review
   - Timeline
   - Export
2. Dropdown:
   - Label: current view
   - Menu: all views

Recommended:
- Use a horizontal segmented control if it fits at 390px without clipping.
- Otherwise use a dropdown labeled "View: Script."

Steps:
1. Replace icon-only tabs on phone with text labels.
2. Ensure tap targets remain at least 40px high.
3. Keep `aria-selected`, `aria-controls`, and tabpanel semantics from Phase 1.

Acceptance criteria:
- Users can identify the active view without relying on icons.
- No tab label clips at 390px.

### 4. Sticky Mobile Action Bar

Files:
- `components/projects/ProjectActionBar.tsx`
- `components/ProjectWorkspace.tsx`

Steps:
1. Render a compact sticky action row above global nav.
2. Show no more than two primary actions and one More button.
3. Use the tab-aware action definitions from Phase 2.
4. Move secondary actions into a bottom sheet.

Examples:
- Script: Import, Render, More.
- Cast: Add Character, More.
- Review: Play, Approve, More.
- Timeline: Preview, Export, More.
- Export: Start Export or Render Missing, More.

Acceptance criteria:
- Primary action is reachable without scrolling.
- The sticky action bar does not cover form submit/cancel buttons.

### 5. Responsive Stage Trail

Files:
- `components/projects/ProjectStageTrail.tsx`

Steps:
1. On mobile, collapse the full stage trail into:
   - current stage pill
   - short summary text, such as "Rendered 0/3"
2. Provide full stage trail inside a details popover or horizontal scroll only if it remains readable.
3. Do not let "Export ready" or other long labels overflow the viewport.

Acceptance criteria:
- Stage information is readable at 390px.
- No horizontal page scrolling is introduced.

### 6. Mobile Panel Treatments

Files:
- `ProjectImportPanel.tsx`
- `ProjectSettingsPanel.tsx`
- `CastBoard.tsx`
- `ReviewMode.tsx`
- `TimelineReview.tsx`
- `ExportDialog.tsx`

Rules:
- Forms that require focused editing should use full-screen sheets.
- Passive lists can remain inline.
- Avoid nested scroll areas unless the header/action bar is fixed and content padding accounts for it.

Per panel:
- Import: full-screen sheet with preview and sticky Import button.
- Settings: full-screen sheet with sticky Save.
- Cast: inline list with Add Character sticky action.
- Review: queue can become a drawer; transport remains sticky.
- Timeline: simple list first, waveform details expandable.
- Export: readiness checklist first, profile and start action sticky.

Acceptance criteria:
- Each workspace view has a clear primary task.
- Forms remain usable with the on-screen keyboard.

### 7. Layout Safety And Viewport Tests

Files:
- Component CSS/classes in the files above.
- Optional Playwright script or documented manual checks.

Viewports:
- 390x844
- 430x932
- 768x1024
- Desktop smoke at 1440x900

Checks:
- No content hidden under global nav.
- No horizontal overflow.
- No overlapping sticky bars.
- Text inside buttons fits.
- Project switcher opens and closes.
- Import sheet works with keyboard focus.
- Export readiness actions are visible.

Acceptance criteria:
- Mobile Projects can complete a simple flow:
  1. Select project.
  2. Import text.
  3. Switch to Script.
  4. Switch to Export.
  5. See render/export blockers.

## Test Plan

Run:
- `npm run build`

Manual Playwright checks:
- 390x844: project switcher, Script, Export, More sheet.
- 430x932: same flow.
- 768x1024: tablet layout should not unexpectedly use cramped phone controls.
- Desktop: project list and tabbed workspace still match Phase 2 behavior.

## Risks

- Hiding the project list can make switching feel less obvious. The selected project row must clearly act as a switcher.
- Sticky action bars can collide with child sticky controls like Review transport. Prefer one sticky action region per view.
- Keyboard and safe-area behavior can differ across mobile browsers. Use conservative padding and avoid viewport-unit-only heights.

## Done Definition

Phase 4 is done when Projects on a phone has one navigation layer, visible primary actions, readable stage state, and no content hidden under fixed bars.
