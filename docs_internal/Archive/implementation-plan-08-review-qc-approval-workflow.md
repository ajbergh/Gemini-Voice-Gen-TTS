# Implementation Plan: Review, QC, and Approval Workflow

## Related Enhancement

Review, QC, and Approval Workflow.

## Current Foundations

- History playback exists.
- Mini player and keyboard shortcuts exist.
- Take management will provide approved/flagged status.
- Audio finishing will provide waveform and timeline markers.

## Target Outcome

Creators can listen through rendered segments efficiently, approve good takes, flag issues, add notes, and filter unresolved work before export.

## Phase 1: QC Data Model

Add migrations:

- `qc_issues`
  - `id`
  - `project_id`
  - `section_id`
  - `segment_id`
  - `take_id`
  - `issue_type` (`pronunciation`, `pacing`, `tone`, `volume`, `artifact`, `missing_pause`, `wrong_voice`, `bad_emphasis`, `other`)
  - `severity` (`low`, `medium`, `high`)
  - `note`
  - `time_offset_seconds`
  - `status` (`open`, `resolved`, `wont_fix`)
  - timestamps

Add status rollups:

- segment has open QC issues
- project unresolved issue count

## Phase 2: Backend APIs

Routes:

- `GET /api/projects/{id}/qc`
- `POST /api/projects/{id}/qc`
- `PUT /api/qc/{issueId}`
- `DELETE /api/qc/{issueId}`
- `POST /api/qc/{issueId}/resolve`
- `GET /api/projects/{id}/qc/export`

Export:

- CSV
- Markdown

## Phase 3: Review Mode UI

Add components:

- `ReviewMode.tsx`
- `ReviewQueue.tsx`
- `ReviewTransport.tsx`
- `QcIssueDialog.tsx`
- `QcIssueList.tsx`
- `ApprovalHotkeys.tsx`

Review queue filters:

- all rendered
- unreviewed
- flagged
- unresolved issues
- changed since approval

Hotkeys:

- Space: play/pause
- A: approve take
- F: flag issue
- R: replay segment
- N: next segment
- P: previous segment
- M: add marker/note

## Phase 4: Approval Rules

Rules:

- Approving a take sets segment status to `approved`.
- Flagging a take sets take or segment status to `flagged`.
- Editing an approved segment text sets status to `changed` and preserves the approved take for traceability.
- Export defaults to approved takes only.

## Phase 5: Timeline Integration

Timeline review should show:

- current segment
- approved/flagged state
- open issue markers
- note count
- current playback position

## Technical Risks

- Hotkeys can conflict with text editing. Enable review hotkeys only when focus is outside editable fields or when Review Mode is active.
- Approval state must be deterministic when multiple takes exist.
- QC issue export should include stable identifiers and enough context for external review.

## Testing Plan

Backend:

- QC CRUD and status transition tests.
- Export format tests.

Frontend:

- Hotkey behavior tests where feasible.
- Playwright flow: play segment, approve take, flag issue, resolve issue, export notes.

## Exit Criteria

- A creator can review a chapter from start to finish using keyboard controls, approve takes, flag issues, and export unresolved notes.

