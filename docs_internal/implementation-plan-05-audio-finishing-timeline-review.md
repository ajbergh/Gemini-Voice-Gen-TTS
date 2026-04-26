# Implementation Plan: Audio Finishing and Timeline Review

## Related Enhancement

Audio Finishing Pipeline.

Merged UI/UX item:
- Integrated waveform and timeline review.

## Current Foundations

- The app decodes 24 kHz 16-bit mono PCM in the browser.
- `AiTtsPreview.tsx` and dialogue code can create WAV files.
- Audio cache stores raw PCM files.
- `AudioVisualizer.tsx` provides a visual foundation, but not an editable waveform or timeline.

## Target Outcome

Creators can normalize, trim, stitch, review, and export production-ready WAV chapter or spot files. The UI shows a useful timeline with segment boundaries, notes, flags, and click-to-seek playback.

## Phase 1: Audio Utility Layer

Create shared frontend utilities:

- `audio/pcm.ts`
- `audio/wav.ts`
- `audio/analysis.ts`
- `audio/finishing.ts`

Functions:

- decode base64 PCM to `Float32Array`
- encode PCM to WAV
- calculate duration
- calculate peak
- detect clipping
- trim leading/trailing silence
- concatenate PCM buffers
- insert silence between buffers

Keep these utilities independent from React components.

## Phase 2: Backend Audio Metadata

Add optional fields to take or history metadata:

- `duration_seconds`
- `peak_dbfs`
- `rms_dbfs`
- `clipping_detected`
- `sample_rate`
- `channels`
- `format`

Initial analysis can run client-side after generation and be posted with take metadata, or run backend-side when audio is cached. Prefer backend-side for batch renders once utilities exist in Go.

## Phase 3: Basic Finishing Profiles

Add `export_profiles` table:

- `id`
- `name`
- `target_kind` (`audiobook`, `podcast`, `broadcast`, `web_video`, `raw`)
- `trim_silence`
- `silence_threshold_db`
- `leading_silence_ms`
- `trailing_silence_ms`
- `inter_segment_silence_ms`
- `normalize_peak_db`
- `metadata_json`
- timestamps

Start with peak normalization and silence trim. Defer full LUFS normalization until a reliable loudness algorithm is selected.

## Phase 4: Timeline UI

Add components:

- `WaveformCanvas.tsx`
- `TimelineReview.tsx`
- `TimelineMarker.tsx`
- `SegmentTimelineRow.tsx`
- `ExportProfilePicker.tsx`

Timeline behavior:

- Render waveform from take PCM.
- Show segment boundaries.
- Show note markers and flags.
- Click to seek.
- Keyboard controls for play/pause, next segment, previous segment.
- Show clipping warnings.

Use the global `AudioProvider` rather than creating another isolated audio engine.

## Phase 5: Chapter and Spot Stitching

Export flow:

1. Select approved takes for a chapter, section, or campaign variant.
2. Apply trim and normalization rules.
3. Insert configured silence.
4. Concatenate buffers.
5. Generate WAV.
6. Save export job metadata.

Routes:

- `POST /api/projects/{id}/exports/preview`
- `POST /api/projects/{id}/exports`
- `GET /api/exports/{exportId}`
- `GET /api/exports/{exportId}/download`

Start with browser-side WAV generation for small exports and backend-side export jobs for larger batches.

## Phase 6: MP3 and M4B Strategy

Do not add MP3/M4B in the first finishing release.

Options to evaluate:

- Browser encoder dependency for MP3.
- Optional external `ffmpeg` detection.
- Go encoder library that does not violate the pure Go/no CGo packaging goal.

Keep v1 deliverables as WAV plus metadata.

## Technical Risks

- LUFS normalization is more complex than peak normalization. Label v1 controls accurately.
- Large projects can exceed browser memory if full chapters are processed client-side.
- Timeline rendering needs stable dimensions and virtualization for long chapters.

## Testing Plan

Audio utilities:

- Unit tests for WAV headers, trim behavior, peak detection, and concatenation.

Backend:

- Export profile CRUD tests.
- Export path safety tests.

Frontend:

- Canvas render smoke tests.
- Playwright review flow for click-to-seek and marker display.

## Exit Criteria

- A creator can export an approved chapter or spot as a stitched WAV with silence trimming, peak normalization, segment spacing, and reviewable timeline markers.

