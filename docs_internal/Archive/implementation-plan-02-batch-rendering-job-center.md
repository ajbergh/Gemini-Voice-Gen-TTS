# Implementation Plan: Batch Rendering and Global Job Center

## Related Enhancement

Batch Rendering and Render Queue.

Merged UI/UX item:
- Add a global job center.

## Current Foundations

- `backend/internal/handler/ws_progress.go` provides `ProgressHub` and WebSocket broadcasts.
- `api.ts` exposes `connectProgress()`.
- `VoicesHandler.GenerateTTS` emits a small set of progress events.
- API key pool support already exists for round-robin provider key usage.
- Script Projects will provide the segment model that batch rendering needs.

## Target Outcome

Users can queue a project, chapter, scene, or selected segments for rendering. They can watch truthful progress, pause/cancel where possible, retry failures, and return to completed outputs without guessing whether work is still running.

## Phase 1: Standardize Job and Progress Models

Add migrations:

- `jobs`
  - `id`
  - `job_type` (`tts_segment`, `batch_render`, `headshot`, `script_prep`, `export`)
  - `status` (`queued`, `running`, `paused`, `canceling`, `canceled`, `failed`, `completed`)
  - `project_id`
  - `section_id`
  - `segment_id`
  - `total_items`
  - `completed_items`
  - `failed_items`
  - `percent`
  - `message`
  - `error`
  - `metadata_json`
  - timestamps

- `job_items`
  - `id`
  - `job_id`
  - `segment_id`
  - `status`
  - `attempt_count`
  - `last_error`
  - `sort_order`
  - timestamps

Update `ProgressEvent`:

- Add `item_id`
- Add `project_id`
- Add `segment_id`
- Add `completed_items`
- Add `total_items`
- Add `error_code`

Keep backward compatibility in `api.ts` by making new fields optional.

## Phase 2: Backend Queue Execution

Add package:

- `backend/internal/jobs`

Core types:

- `JobRunner`
- `JobStore`
- `RenderJobPayload`
- `CancellationRegistry`

Queue rules:

- Single-process in-memory executor first, persisted job state in SQLite.
- Limit concurrent TTS calls with configurable worker count, default `1`.
- Persist every status transition before broadcasting.
- Mark interrupted running jobs as failed or queued on server startup depending on final implementation choice.

Routes:

- `GET /api/jobs`
- `GET /api/jobs/{id}`
- `POST /api/jobs/render`
- `POST /api/jobs/{id}/pause`
- `POST /api/jobs/{id}/resume`
- `POST /api/jobs/{id}/cancel`
- `POST /api/jobs/{id}/retry`
- `DELETE /api/jobs/{id}`

Render route payload:

- `project_id`
- optional `section_id`
- optional `segment_ids`
- `render_changed_only`
- `overwrite_existing`
- `provider`
- `model`

## Phase 3: Segment Render Integration

For each segment:

1. Load effective render settings from segment, section, project defaults, style preset, cast assignment, and provider defaults.
2. Apply pronunciation dictionary transformations.
3. Build final TTS prompt.
4. Generate audio through Gemini or selected provider.
5. Write raw PCM to audio cache.
6. Create a take row once take management exists, or temporarily update segment render metadata.
7. Update segment status and content hash.
8. Emit job progress.

Failure handling:

- Retry provider overloads and transient 5xx responses.
- Do not retry validation errors, blocked prompts, missing keys, or unsupported provider/voice combinations.
- Store the raw provider error in job metadata for debugging, but show a user-safe message in UI.

## Phase 4: Frontend Job Store and Job Center

Add frontend state:

- `components/JobProvider.tsx`
- `components/JobCenter.tsx`
- `components/JobDrawer.tsx`
- `components/JobToastBridge.tsx`
- `components/JobStatusBadge.tsx`

Behavior:

- Connect once to `/api/ws/progress`.
- Reconcile initial state with `GET /api/jobs` on load.
- Merge WebSocket events into a job map.
- Show a compact jobs button in the app shell.
- Show inline status on active project segments.
- Toast only important job transitions: completed, failed, canceled.

## Phase 5: UI Integration

Project workspace:

- Render selected segment.
- Render changed segments.
- Render current chapter.
- Render full project.

Job Center:

- Active jobs.
- Recently completed jobs.
- Failed items with retry buttons.
- Cancel for queued/running jobs.
- Link back to project and segment.

Settings:

- Default concurrency.
- Retry count.
- Preferred provider.
- Whether to continue batch after a segment fails.

## Technical Risks

- A local single-binary app has no distributed worker system. Keep v1 single-process and persisted enough for recovery.
- Canceling an in-flight HTTP request requires request context propagation through the Gemini client.
- Progress events can arrive before a UI has loaded job details. Always reconcile from the database.
- Provider rate limits and API key pool behavior need clear status reporting.

## Testing Plan

Backend:

- Job store transition tests.
- Queue runner tests with fake TTS clients.
- Retry/cancel tests.
- WebSocket event shape tests.

Frontend:

- TypeScript build.
- Simulated WebSocket event tests for the job reducer.
- Playwright flow: queue two segments, watch progress, cancel one job, retry failed job.

## Exit Criteria

- No production render flow depends on simulated progress.
- Batch jobs persist status, emit real-time updates, and can recover enough state after restart to avoid lost work.

