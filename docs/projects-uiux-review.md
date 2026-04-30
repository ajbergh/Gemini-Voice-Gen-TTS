# Projects UI/UX Review and SaaS Polish Recommendations

## Scope

This review was run with Playwright against the running Vite instance at `http://localhost:3000`, with representative API responses mocked at the browser boundary so the Projects workspace had realistic project, segment, QC, review, and export states.

Screenshots and the observation log are saved in:

- `output/playwright/projects-ui-review/desktop-projects-overview.png`
- `output/playwright/projects-ui-review/desktop-new-project.png`
- `output/playwright/projects-ui-review/desktop-tab-review.png`
- `output/playwright/projects-ui-review/desktop-tab-export.png`
- `output/playwright/projects-ui-review/mobile-projects-overview.png`
- `output/playwright/projects-ui-review/mobile-project-switcher.png`
- `output/playwright/projects-ui-review/mobile-import-sheet.png`
- `output/playwright/projects-ui-review/mobile-export-tab.png`
- `output/playwright/projects-ui-review/observations.json`

The walkthrough covered desktop Projects navigation, project search, new project creation, project settings, Script/Cast/Review/Timeline/Export tabs, and mobile project switching/import/export.

## Executive Summary

The Projects workspace is functional and already has the right core product surfaces: project list, script structure, cast, review, timeline, export readiness, and mobile project switching. The main opportunity is to make it feel more intentional, less prototype-like, and more like a paid production SaaS tool.

The biggest issues are visual hierarchy, action hierarchy, cramped project metadata, and mobile polish. Most screens use many similarly weighted bordered panels, small pills, and icon-first controls, so the user has to infer what matters. A paid SaaS version should make project state, next action, ownership, and risk visible immediately.

## What Worked

- No horizontal overflow was detected in the Playwright run on desktop or mobile.
- Core Projects navigation is discoverable from the global sidebar and bottom nav.
- The stage trail, stats, review, timeline, and export readiness concepts are strong foundations.
- Review mode has a clear approve/flag workflow and feels closer to a specialized production tool than the rest of the surface.
- Mobile project switching is a good pattern and avoids forcing the desktop sidebar into a small viewport.

## Highest Priority Recommendations

### 1. Make Project Status and Next Action Obvious

Current state: The header shows badges and a stage trail, but it does not clearly answer "what should I do next?" The user sees "Rendered 2/3", "Reviewed 1/2", "1 QC", and "Export ready" as small pills spread across the UI.

Recommendation:

- Add a compact project health strip near the title with `Needs render`, `Open QC`, `Ready to review`, and `Export blocked` states.
- Convert the stage trail into a single progress component with explicit counts and a highlighted blocker.
- Add one contextual primary next action: `Render missing audio`, `Review 1 take`, `Resolve 1 QC issue`, or `Start export`.
- Keep secondary workflow actions in a command bar, not scattered across tab content and overflow menus.

Impact: Higher confidence, faster onboarding, and a more paid-SaaS "production command center" feel.

### 2. Rework the Project List Into a Real Project Index

Current state: Project cards in the left panel are cramped. Client names clip, count pills are small circles, and active search can show one project while the main workspace still displays a different selected project.

Recommendation:

- Use a denser project index layout with columns/rows: title, client, kind, updated, progress, QC.
- Keep title and client readable before secondary metadata.
- Replace circular `seg` and `QC` bubbles with rectangular status chips or a small progress bar.
- When search filters the list, either preserve a visible "currently open project" affordance or prompt the user to open the filtered result.
- Make the `New project` control a labeled button on desktop. Keep the icon-only version only when space is constrained.

Impact: Better scanability for production users who manage many client workspaces.

### 3. Upgrade New Project Creation From Inline Form to Guided Flow

Current state: New project creation expands inside the project list panel. It works, but it feels cramped and easy to miss. Templates are represented as a select, and the default description textarea looks like editable data rather than a template preview.

Recommendation:

- Open a modal or right drawer with template cards: Audiobook, Voiceover, Podcast, Training, Character Reel, Other.
- Show what each template creates: default sections, suggested voices/settings, and ideal use case.
- Put title, client, language, default voice/model, and template in one focused create flow.
- Make the create button full width or visually primary in the drawer.
- After creation, show a short success state and land the user on the first recommended task: import script or add segment.

Impact: A more confident first-run experience and a stronger product-grade onboarding moment.

### 4. Improve Mobile Sticky Controls and Sheets

Current state: Mobile avoids horizontal overflow, but several controls feel squeezed. The `Timeline` tab truncates to `Timel...`, the sticky action bar competes with content, and the import sheet does not close on Escape in the Playwright walkthrough.

Recommendation:

- Make mobile tabs horizontally scrollable with visible scroll affordance, or use icons plus short labels that never truncate awkwardly.
- Add safe-area-aware bottom padding to tab panels so content and export controls are not obscured by the action bar/bottom nav.
- Give the import sheet close icon an accessible label and support Escape dismissal.
- Keep sticky action bars visually separate from page content with stronger elevation, top border, and reserved layout space.
- Use a bottom sheet for short mobile tasks and full-screen sheet only for long text import/editing.

Impact: Better perceived quality on phone and fewer blocked task completions.

### 5. Establish a More Premium Visual System

Current state: The app uses many white cards with borders, small gray labels, and sparse hierarchy. It is clean, but it reads more like a functional internal tool than a polished paid SaaS product.

Recommendation:

- Use a consistent radius scale, ideally 8px for cards and controls unless a component has a specific reason to be round.
- Reduce the number of competing bordered containers. Use page bands, table/list sections, and subtle background blocks instead.
- Use one product accent for active state, focus, and primary actions. Avoid sprinkling several status colors at the same visual weight.
- Replace the serif project title with the app's product sans style, or reserve serif type for content/editorial views only.
- Make primary buttons consistent: one dark/accent primary, neutral secondary, destructive red only for destructive actions.
- Use typography size and weight to create a clear scan path: page title, health/next action, tabs, content.

Impact: More cohesive, enterprise-grade presentation without changing the underlying workflows.

## Detailed Findings

### Desktop Projects Overview

Issues:

- The page has three navigation systems at once: global sidebar, Projects list sidebar, and project tabs. This is expected for a production app, but the hierarchy is visually flat.
- The project title area is useful but underpowered. The next meaningful action is not clear until the user interprets several small badges.
- Stats cards consume a full row for three numbers but do not communicate trend, risk, or next step.
- Segment cards are easy to read, but model/provider pills are visually louder than they need to be.

Recommendations:

- Treat the top of the project workspace as a status dashboard: readiness, blockers, next action.
- Collapse raw stats into a smaller strip or combine them with health state.
- Move provider/model detail into a secondary metadata row or reveal it on segment expansion.
- Add filters for segment status, speaker, voice, and QC directly above the segment list.

### Project Search and List Management

Issues:

- Searching `Launch` filtered the list to the launch project while the main content still showed the selected Northstar project. This can feel inconsistent.
- The selected project card remains visually strong, but inactive cards have tightly packed metadata.
- Project options are discoverable only on hover/focus in desktop cards.

Recommendations:

- Add an "Open result" behavior or clear selected-project messaging when search hides the active project.
- Introduce saved views: Active, Needs review, Blocked, Recently updated, Archived.
- Show last updated date and owner/client in a consistent location.
- Keep project options visible on selected/hovered rows and align the menu to the row edge.

### New Project Flow

Issues:

- The inline form makes the sidebar feel overloaded.
- Template selection is a plain select, so the product value of templates is hidden.
- The description field looks like user-authored content even when it is template-generated copy.

Recommendations:

- Use template cards with short examples and icons.
- Separate template description from project description.
- Add client defaults and production defaults in an advanced section.
- Provide a small "Create and import script" path after project creation.

### Project Settings

Issues:

- The settings drawer is useful and does not shift content, which is good.
- It has two close affordances: the drawer close and an additional `x` inside the card, which weakens visual confidence.
- The content is mostly form controls without explanatory hierarchy.

Recommendations:

- Use a single drawer close control.
- Group settings as `Voice defaults`, `Language/model`, `Style`, and later `Export defaults`.
- Add helper text only where it prevents mistakes, such as model/provider fallback behavior.
- Add a clear saved/unsaved state and prevent accidental close with dirty changes.

### Review, Timeline, and Export

Issues:

- Review is the strongest screen, but the playback area still feels abstract. There is little audio-specific visual feedback in the screenshot.
- Timeline readiness is helpful, but timeline rows are visually understated.
- Export is centered in a small card with a lot of unused canvas, so it feels modal-like rather than like a complete workflow page.
- The export button is disabled, but the page could do more to guide the user to unblock export.

Recommendations:

- Add waveform or duration visualization to review and timeline rows.
- Make QC issues a first-class side panel or inline blocker list with direct navigation to the affected segment.
- Make Export a full-width workflow section with: profile selection, readiness checklist, package contents, naming options, and export history.
- Replace the disabled export dead end with a guided checklist where each blocker has a direct action button.

### Mobile Projects

Issues:

- The mobile header has good structure, but there is too much vertical setup before the user reaches content.
- `Timeline` truncates in the tab bar.
- The sticky action bar and bottom nav leave limited room for content and can make the page feel crowded.
- The import full-screen sheet did not close on Escape during the automated walkthrough.

Recommendations:

- Compress the project summary after scroll or pin only the project switcher plus current blocker.
- Use a horizontally scrollable tab row or a segmented control with shorter labels.
- Reserve layout space for the sticky project action bar.
- Add Escape handling and an accessible label for the import close icon.
- On mobile Export, ensure readiness details and primary action sit above the bottom nav with enough padding.

## Paid SaaS Look and Feel Direction

Use a more operational, production-grade visual language:

- App shell: quieter global nav, stronger active project identity, fewer decorative controls in the primary nav.
- Project list: table/list density, status columns, saved views, and clearer sorting.
- Header: project health, SLA/readiness, owner/client, last updated, and next action.
- Tabs: consistent icon/label sizing, active underline, and stable mobile behavior.
- Cards: fewer nested cards, clearer section bands, predictable 8px radius.
- Status system: standardized statuses with consistent colors and severity levels.
- Empty states: task-oriented, not just "no data"; each empty state should offer the next useful action.

## Quick Wins

- Label the desktop `New project` button with text.
- Replace `Prep` with `Script prep` or `AI prep`.
- Add `aria-label` to the import sheet close button and support Escape.
- Add bottom padding to mobile tab panels for sticky action bars.
- Replace circular segment/QC counters in project cards with readable chips.
- Fix the production warning by removing Tailwind CDN from the production build path.
- Add a contextual next-action button in the project header.

## Larger Redesign Items

- Redesign project creation as a template-driven drawer/modal.
- Redesign the Projects list as a project index with saved views and richer metadata.
- Convert Export into a complete workflow page with package preview and export history.
- Add a project health/readiness system shared by header, timeline, and export.
- Build a mobile-specific command model for tabs and actions rather than shrinking the desktop layout.

## Verification Notes

Playwright found no page JavaScript errors and no horizontal overflow in the audited desktop/mobile viewports. The console did report the Tailwind CDN production warning twice, which should be addressed before positioning the app as a polished paid SaaS product.
