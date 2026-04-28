# Projects UI/UX Phase 1 - Polish And Trust Fixes

> Parent plan: `docs_internal/projects-uiux-enhancements-plan.md`  
> Goal: make the current Projects workspace feel coherent and trustworthy without changing the main architecture or schema.

## Implementation Status

Status: Complete  
Started: 2026-04-28  
Completed: 2026-04-28  
Owner: Codex

Progress:
- [x] Reviewed Phase 1 plan against current code.
- [x] Normalize inline tab semantics.
- [x] Make export readiness truthful.
- [x] Correct take wording.
- [x] Add minimal mobile padding guard.
- [x] Add progress connection fallback.
- [x] Add favicon and document remaining console hygiene.
- [x] Run automated and manual verification.

Implementation notes:
- `ProjectWorkspace.tsx` now gives workspace tabs stable ids/controls and wraps the active content branch in a labelled `tabpanel`.
- Cast, Review, and Export tabs no longer pass close handlers for inline workspace rendering, so modal close affordances are hidden there.
- `ReviewMode.tsx` uses a `div` instead of a nested `main` in inline mode and ignores Escape unless rendered as a closable modal.
- `ExportDialog.tsx` disables accidental export when a project has no segments or no rendered audio; partial export copy is explicit.
- `SegmentTakeList.tsx` now uses "Add take" language for manual take metadata creation.
- `JobProvider.tsx` exposes live progress connection status and polls persisted jobs as a fallback; `JobCenter.tsx` shows a low-noise disconnected message.
- `assets/favicon.svg` is linked from `index.html`; the Tailwind CDN warning remains a documented non-blocking production-build concern for a later setup change.
- The mobile guard was tightened after Playwright verification: on phones, the project sidebar is hidden whenever a non-Script workspace tab is active so Export actions are not pushed behind the fixed nav bars.

Verification results:
- `npm run build` passed.
- `go test ./internal/store ./internal/handler ./internal/server` passed from the `backend/` module directory.
- Playwright desktop checks passed for Projects Script, Cast, Review, and Export tabs.
- Playwright mobile 390x844 check passed for Export: the disabled `Start Export` action and reason text are reachable above the fixed project/global nav bars.
- Current browser console on `http://localhost:3000` showed no errors during the final Playwright pass; the remaining warnings are Tailwind CDN and React DevTools development notices.

Accuracy notes:
- The confirmed issues still match the current implementation.
- Progress connection status requires a small `connectProgress` API callback extension so `JobProvider` can distinguish connected, disconnected, and reconnecting states.
- Phase 1 should avoid backend schema/API changes except for tests already covering the existing backend surface.

## Scope

Phase 1 is a focused cleanup pass. It should not introduce new project templates, project search, duplicate project APIs, mobile navigation redesign, or a new export system. The intent is to remove modal leftovers, make blocked actions truthful, improve labels, and tighten accessibility semantics.

## Initial Issues Confirmed

- `ProjectWorkspace.tsx` renders Cast, Review, Timeline, and Export as tabs.
- `CastBoard.tsx` required `onClose` and rendered "Close cast board."
- `ReviewMode.tsx` rendered "Close review mode" and used a nested `<main>` while inline.
- `ExportDialog.tsx` rendered "Close export dialog" and "Start Export" when zero segments had audio.
- `SegmentTakeList.tsx` used "Record take" language for a manual take metadata form.
- `ProjectWorkspace.tsx` rendered the mobile project tab bar above the global bottom nav.
- Vite preview showed missing favicon and progress WebSocket timeout warnings during audit.

## Implementation Slices

### 1. Normalize Inline Tab Semantics

Files:
- `components/ProjectWorkspace.tsx`
- `components/CastBoard.tsx`
- `components/ReviewMode.tsx`
- `components/ExportDialog.tsx`

Steps:
1. Add stable tab ids in `ProjectWorkspace.tsx`.
   - Example ids: `project-tab-script`, `project-panel-script`.
   - Set `aria-controls` on each tab.
   - Wrap each tab content in a `section role="tabpanel"` with `id`, `aria-labelledby`, and a single visible content branch.
2. Remove modal close affordances from inline tab content.
   - Make `CastBoard` accept `onClose?: () => void`.
   - Only render the X close button when `onClose` exists and the board is used outside a tab.
   - In `ProjectWorkspace.tsx`, render `CastBoard` without `onClose` for the tab.
3. Make `ReviewMode` inline-safe.
   - Change `onClose` to optional or add `showCloseButton?: boolean`.
   - Hide the close button when `inline` is true.
   - Do not close on Escape when no close handler is provided.
   - Replace the nested inline `<main>` with a `div` when `inline` is true. Keep `<main>` only for full-screen standalone mode.
4. Make `ExportDialog` inline-safe.
   - Hide the close button when `inline` is true, or rename the component later in Phase 2.
   - Disable focus trapping and initial close-button focus when `inline` is true.
   - Keep `role="dialog"` only for modal mode. Inline mode should rely on the parent tabpanel role.

Acceptance criteria:
- No visible close button appears in Cast, Review, or Export workspace tabs.
- The Projects page has one primary `main` landmark.
- Tab panels have usable labels and controls for assistive tech.

### 2. Make Export Readiness Truthful

Files:
- `components/ExportDialog.tsx`
- `components/ProjectWorkspace.tsx`
- Optional: `components/TimelineReview.tsx`

Steps:
1. Derive export readiness in `ExportDialog`.
   - `totalSegments === 0`: no exportable project content.
   - `renderedSegments === 0`: no audio to export.
   - `renderedSegments < totalSegments`: partial export state.
   - `renderedSegments === totalSegments`: ready state.
2. Disable "Start Export" when `totalSegments > 0 && renderedSegments === 0`.
3. Add a short disabled reason next to the action:
   - "Render at least one segment before exporting."
4. Keep partial export allowed only if the copy is explicit:
   - "Export will include only segments with audio."
5. If product intent is to export only fully rendered projects, disable when `renderedSegments < totalSegments` and move partial export to a later explicit option.

Acceptance criteria:
- A project with zero rendered segments cannot start export by accident.
- Partial export copy is explicit and not hidden in secondary text.
- Timeline and Export communicate the same readiness state.

### 3. Correct Take Wording

Files:
- `components/SegmentTakeList.tsx`

Current behavior:
- The form calls `createSegmentTake`.
- It creates a take record with status/duration metadata.
- It does not invoke TTS rendering.

Steps:
1. Replace "Record take" with "Add take."
2. Replace "Take recorded" toast with "Take added."
3. Replace "Failed to record take" with "Failed to add take."
4. Rename local handler variables only if the change stays mechanical and low-risk.
5. Reserve "Render take" or "Generate take" for an action that calls `reRenderSegment` or a future take-specific render endpoint.

Acceptance criteria:
- UI copy matches actual behavior.
- No user-facing label implies live recording or TTS rendering unless the action actually does that.

### 4. Add Minimal Mobile Padding Guard

Files:
- `components/ProjectWorkspace.tsx`
- Optional: `components/NavigationSidebar.tsx`

Steps:
1. Keep the full mobile navigation redesign for Phase 4.
2. In Phase 1, add enough bottom padding to the Projects scroll container when both fixed bars can be visible.
3. Use a single constant or CSS class for the combined fixed bar height.
   - Global mobile nav is roughly `bottom-0 h-14`.
   - Project mobile tabs are currently `bottom-14 h-14`.
4. Ensure tab content never ends behind either bar.

Acceptance criteria:
- At 390x844, Export action buttons are reachable without being covered.
- Script add-segment forms and Review transport controls remain visible above fixed bars.

### 5. Progress Connection Fallback

Files:
- `components/JobProvider.tsx`
- `api.ts`
- Optional: `components/JobCenter.tsx`

Steps:
1. Track progress connection status in `JobProvider`.
   - `connecting`, `connected`, `disconnected`, `reconnecting`.
2. Expose the status through `useJobs`.
3. Show a low-noise fallback in Job Center when disconnected:
   - "Live progress disconnected. Job history will refresh periodically."
4. Continue polling persisted jobs so the workspace is usable without WebSocket updates.
5. Verify `/api/ws/progress` under Vite dev/preview and Go-served production.

Acceptance criteria:
- WebSocket failures do not create silent uncertainty.
- Jobs and render state still update through polling when live progress is unavailable.

### 6. Console Hygiene

Files:
- `index.html`
- `assets/`
- Optional future: `index.css`, Tailwind build configuration

Steps:
1. Add a favicon asset and link it from `index.html`.
2. Treat the Tailwind CDN warning as a known production build issue.
3. Do not remove CDN Tailwind in Phase 1 unless the build pipeline is moved to a proper Tailwind/PostCSS setup in the same change.

Acceptance criteria:
- Missing favicon is fixed.
- Any remaining console warning is documented and non-blocking.

## Test Plan

Run:
- `npm run build`
- `cd backend && go test ./internal/store ./internal/handler ./internal/server`

Manual Playwright checks:
- Desktop Projects: Script, Cast, Review, Timeline, Export tabs.
- Mobile 390x844 Projects: Script and Export content not hidden under fixed nav.
- Export with zero rendered segments: Start Export disabled or explicitly replaced by a render-first action.
- Review inline tab: no close button, no nested main landmark.

## Risks

- Removing close buttons can reveal assumptions in tests or keyboard handling.
- Hiding Escape close behavior in inline mode may affect users who relied on Escape to leave Review. The tab strip remains the correct navigation path.
- Export readiness depends on the meaning of `renderedSegments`, which currently treats rendered/approved status as audio-ready. If audio availability can differ from status, later phases should use take/audio presence instead.

## Done Definition

Phase 1 is done when the existing workspace feels like one tabbed product surface, blocked export actions are truthful, mobile content is not obscured, and the build/test/manual checks above pass.
