# Implementation Plan: Mobile and Narrow-Screen Workflow

## Related Enhancement

Better Mobile and Narrow-Screen Workflow.

This is a unique cross-cutting UI/UX plan because every production feature needs a narrow-screen interaction model.

## Current Foundations

- `NavigationSidebar.tsx` already switches to a mobile bottom tab bar under `1280px`.
- Current controls are often dense and desktop-oriented, especially TTS preview controls and script tooling.
- The production workspace plans introduce multi-pane layouts that need responsive alternatives.

## Target Outcome

The app remains useful on tablets, small laptops, and phones for review, light editing, and approvals. Long-form production can degrade from multi-pane desktop layout into focused tabs without losing key actions.

## Phase 1: Responsive Workspace Architecture

Define breakpoints:

- desktop: multi-pane workspace
- tablet/narrow: two-pane or tabbed workspace
- phone: single-pane tabs with sticky transport

Production workspace mobile tabs:

- Script
- Cast
- Takes
- Jobs
- Review

Implementation:

- Add `useResponsiveMode()` hook.
- Centralize layout mode in workspace shell.
- Avoid each component inventing its own width logic.

## Phase 2: Sticky Transport and Primary Actions

Add mobile bottom action surface:

- play/pause
- render selected
- approve
- flag
- next segment
- previous segment

Rules:

- Use icon buttons with accessible labels.
- Keep targets at least 44 px.
- Hide secondary metadata behind drawers.

## Phase 3: Component Adaptations

Segment editor:

- Full-width segment cards.
- Collapsible settings.
- Single selected segment inspector as a bottom sheet.

Take list:

- Swipe or menu actions for approve/reject/export.
- A/B compare as stacked cards rather than side-by-side.

Job center:

- Full-screen drawer on phone.
- Compact status row on tablet.

Cast board:

- Group tabs instead of columns.

Timeline:

- Horizontal scroll with pinch/zoom deferred.
- Tap markers to open notes.

## Phase 4: Accessibility and Text Fitting

Requirements:

- No text overlaps inside buttons/cards.
- Avoid viewport-scaled fonts.
- Use stable dimensions for toolbars and icon buttons.
- Preserve keyboard access on tablet/laptop.
- Maintain screen-reader labels for icon-only controls.

## Phase 5: Playwright Viewport Checks

Add visual smoke scripts:

- desktop `1440x900`
- tablet `1024x768`
- small laptop `1280x720`
- phone `390x844`

Check:

- no horizontal page overflow
- no overlapped top/bottom nav
- bottom transport does not hide editable fields
- modals/drawers fit and scroll
- primary actions remain visible

## Technical Risks

- Multi-pane features can become unusable if merely stacked. Design explicit mobile flows.
- Bottom nav plus mini player plus sticky transport can collide. Define z-index and vertical space ownership.
- Canvas waveform/timeline rendering needs separate sizing logic on mobile.

## Testing Plan

Frontend:

- TypeScript build.
- Playwright screenshot checks across target viewports.
- Manual touch target inspection.
- Keyboard navigation check for tablet/laptop widths.

## Exit Criteria

- Core review and approval workflows work cleanly on phone-sized viewports, and full project editing remains comfortable on tablet and narrow laptop screens.

