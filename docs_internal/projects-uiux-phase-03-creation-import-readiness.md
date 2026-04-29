# Projects UI/UX Phase 3 - Professional Creation, Import, And Readiness

> Parent plan: `docs_internal/projects-uiux-enhancements-plan.md`  
> Goal: make Projects feel production-grade from setup through export readiness.

## Scope

Phase 3 builds on the refined shell from Phase 2. It adds richer project creation, import preview, and clear readiness gates for render/review/export.

Out of scope:
- Full mobile redesign.
- Cloud/team workflows.
- Marketplace or sharing workflows.
- New audio finishing DSP beyond existing export profiles.

## Current Baseline

- `ScriptProject` already has `description`, `client_id`, and `metadata_json`.
- Client APIs already exist under `/api/clients`.
- Import parsing currently happens inside `ProjectsHandler.ImportProject`.
- Import writes directly to storage without preview.
- Export has only a profile picker, status summary, and start/download actions.
- Stage trail currently uses frontend-derived project state and simple status counts.

## Design Target

Users should be able to:
1. Create a project using a sensible template.
2. Assign client and production defaults during setup.
3. Preview imported script structure before writing.
4. See exactly what prevents render/review/export readiness.
5. Fix blockers from the same screen.

## Implementation Slices

### 1. Project Templates

Files:
- New: `components/projects/projectTemplates.ts`
- `components/projects/NewProjectSheet.tsx`
- `api.ts`
- Optional backend: no schema change needed for basic templates.

Template shape:
```ts
type ProjectTemplate = {
  id: string;
  label: string;
  kind: ProjectKind;
  description: string;
  defaultSections: Array<{ title: string; kind: ScriptSectionKind }>;
  recommendedDefaults?: {
    language_code?: string;
    style_id?: number;
    metadata?: Record<string, unknown>;
  };
};
```

Initial templates:
- Audiobook Chapters
- Voiceover Spot
- Podcast Episode
- Training Module
- Character Reel
- Blank Project

Steps:
1. Add template selection to the New Project sheet.
2. On project create:
   - send `kind`, `description`, `client_id`, defaults, and `metadata_json` where available.
   - create default sections after project creation using existing `createProjectSection`.
3. If any section creation fails after project creation:
   - show a warning toast.
   - leave the project created.
   - offer retry from the empty script state.
4. Store chosen template id in `metadata_json`.

Acceptance criteria:
- A template-created project has expected kind, optional description, and default sections.
- Blank Project remains available.
- Template metadata does not require migration.

### 2. Client And Description In Creation Flow

Files:
- `components/projects/NewProjectSheet.tsx`
- `api.ts`
- Existing client API functions, if already present.

Steps:
1. Add optional Description field.
2. Add Client/Brand selector.
   - Load clients with existing API if available.
   - Offer "No client" as default.
   - Defer inline client creation unless existing components make it cheap.
3. Persist `description` and `client_id` on `createProject`.
4. Display client name in project header and project list once summaries/client lookup are available.

Acceptance criteria:
- New projects can be created with description and client id.
- Existing projects without client continue to render cleanly.

### 3. Import Preview

Files:
- `backend/internal/handler/api_projects.go`
- `backend/internal/server/routes.go`
- `api.ts`
- `components/ProjectImportPanel.tsx`
- Tests: `backend/internal/handler/api_projects_test.go`

Preferred backend API:
- `POST /api/projects/{id}/import/preview`
- Request: `{ "text": "...", "filename": "optional.md" }`
- Response:
```json
{
  "sections": [
    {
      "title": "Chapter One",
      "kind": "chapter",
      "segments": [
        { "script_text": "First paragraph..." }
      ]
    }
  ],
  "unsectioned_segments": [],
  "section_count": 1,
  "segment_count": 1
}
```

Backend steps:
1. Extract current import parsing from `ImportProject` into a pure helper.
2. Reuse the helper for preview and commit.
3. Keep sorting/appending logic in commit path only.
4. Add tests for:
   - Markdown headings.
   - Plain text without headings.
   - Empty input.
   - Multiple blank lines.
   - Empty heading fallback.

Frontend steps:
1. Add Preview button to `ProjectImportPanel`.
2. Show parsed sections and segment counts before Import.
3. Keep Import disabled until preview has been generated or text changes are intentionally allowed to import directly.
4. On import success, show exact created counts and close the panel.

Acceptance criteria:
- User sees exact section/segment split before committing.
- Preview and commit use the same parsing rules.
- Importing after preview still refreshes project stats and list metadata.

### 4. Export Readiness Checklist

Files:
- New: `components/projects/ExportReadinessChecklist.tsx`
- `components/ExportDialog.tsx`
- `components/TimelineReview.tsx`
- API additions if open QC counts or take counts are not already available.

Checklist items:
- Project has segments.
- Required segments have current rendered takes.
- Review policy is satisfied.
- Open QC issues are resolved or waived.
- Export profile is selected or explicitly skipped.

Data inputs:
- `segments`
- selected/best takes per segment
- `listProjectQcIssues`
- `renderedCount`
- `approvedCount`
- export profile selection

Steps:
1. Build a pure readiness helper:
```ts
type ExportReadiness = {
  canExport: boolean;
  blockers: Array<{ id: string; label: string; action?: string }>;
  warnings: Array<{ id: string; label: string; action?: string }>;
};
```
2. Use the helper in Export and Timeline.
3. Keep policy configurable later; default to warning on unapproved rendered audio, blocker on no audio.
4. Surface direct actions:
   - Render missing audio.
   - Go to Review.
   - Open QC issues.

Acceptance criteria:
- Export blockers are visible and actionable.
- Export and Timeline agree on readiness.
- A user can tell whether they are blocked, warned, or ready.

### 5. Render Missing Audio

Files:
- `components/ProjectWorkspace.tsx`
- `components/ExportDialog.tsx`
- `components/TimelineReview.tsx`
- `api.ts`

Existing API:
- `batchRenderProject(projectId, options?)`
- `reRenderSegment(projectId, segmentId)`

Steps:
1. Add a "Render missing audio" action where readiness detects missing audio.
2. Use batch render if it can target missing/changed segments.
3. If batch options do not support missing-only yet, add backend option:
```ts
type BatchRenderOptions = {
  segment_ids?: number[];
  only_missing?: boolean;
  only_changed?: boolean;
};
```
4. Surface job id and progress through Job Center.
5. Refresh project contents after job completion.

Acceptance criteria:
- Users can resolve missing audio from Export or Timeline.
- Rendering does not require navigating back to Script unless the user wants to edit.

### 6. Data-Backed Stage Trail

Files:
- `components/projects/ProjectHeader.tsx`
- Optional: project summary endpoint from Phase 2.

Stage definitions:
- Setup: project has title, kind, and default voice/provider or explicit skip.
- Scripted: segment count > 0.
- Cast Assigned: all speaker-labeled or cast-required segments have cast profile or voice.
- Rendered: all exportable segments have current audio.
- Reviewed: approved count satisfies policy.
- Export Ready: no blockers from readiness helper.

Steps:
1. Move stage calculation into a pure helper.
2. Unit-test helper behavior if a frontend test setup exists; otherwise keep it deterministic and documented.
3. Make stage trail wrap or scroll safely for small widths.
4. Use the same stage model in project list metadata and project header.

Acceptance criteria:
- Stage trail reflects real project data.
- Stage trail and export checklist do not contradict each other.

## Test Plan

Run:
- `npm run build`
- `go test ./internal/store ./internal/handler ./internal/server`

Manual checks:
- Create project from each template.
- Create project with no client and with a client.
- Preview and import Markdown with multiple sections.
- Preview and import plain text.
- Export checklist with no segments, no audio, partial audio, all audio, open QC issue.
- Render missing audio action starts expected job.

## Risks

- Duplicating import parsing in frontend would drift from backend. Prefer backend preview.
- Template section creation after project creation can partially fail. Handle this explicitly.
- Export readiness rules can become too strict. Start with blockers for impossible states and warnings for quality gates.

## Done Definition

Phase 3 is done when project setup feels intentional, import is previewable, and export readiness tells users exactly what is needed before delivery.

### Current Phase 3 Completion Assessment

**Complete** - Project creation now supports templates, optional descriptions, client assignment, and template metadata. Import preview is backed by the same backend parser used by committed imports. Export and Timeline share the same readiness helper and expose render-missing/review actions. Project summaries are loaded from `GET /api/projects/summary` so list metadata is not limited to the selected project.

Implemented code:
- `components/projects/projectTemplates.ts` and `NewProjectSheet.tsx` provide the template-first creation flow.
- `components/ProjectImportPanel.tsx`, `api.ts`, `backend/internal/handler/api_projects.go`, and `backend/internal/server/routes.go` implement `POST /api/projects/{id}/import/preview`.
- `components/projects/exportReadiness.ts` and `ExportReadinessChecklist.tsx` drive consistent Timeline and Export blockers/warnings.
- `components/ProjectWorkspace.tsx` wires clients, summaries, import preview, render-missing audio, and readiness actions.
- `components/projects/ProjectHeader.tsx` contains the data-backed stage trail. A separate `ProjectStageTrail.tsx` file was not created because the stage display remains header-local and presentational.
- `backend/internal/store/projects.go` implements project summaries, and `backend/internal/handler/api_batch.go` allows failed segments to be re-rendered by missing-audio flows.

Validation passed:
- `npm run build`
- `go test ./internal/store ./internal/handler ./internal/server`
- `npx playwright test tests/projects/projects.spec.ts --project=chromium --workers=1 --headed`

Remaining follow-up, not blocking Phase 4:
- Extract the stage calculation from `ProjectHeader.tsx` only if another component needs to consume the same model.
- Add dedicated frontend unit tests for readiness/stage helpers if a frontend unit test harness is introduced.
