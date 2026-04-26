# Implementation Plan: AI Script Prep for Narration

## Related Enhancement

AI Script Prep for Narration.

## Current Foundations

- `/api/voices/format-script` calls Gemini to restructure raw script text.
- `ScriptReaderModal.tsx` exposes a Format button.
- AI Casting Director already returns structured recommendations.
- Projects, pronunciation dictionaries, cast profiles, and style presets will provide targets for richer script prep output.

## Target Outcome

AI prep turns raw manuscript or voiceover copy into a draft production structure: chapters/scenes/segments, likely speakers, pronunciation candidates, suggested styles, and warnings.

## Phase 1: Structured Prep Response

Add new backend client method:

- `PrepareScriptForNarration(rawScript, projectKind, options)`.

Return structured JSON:

- `sections`
- `segments`
- `speaker_candidates`
- `pronunciation_candidates`
- `style_suggestions`
- `warnings`

Keep the existing `format-script` endpoint for simple formatting.

New route:

- `POST /api/projects/{id}/prepare-script`

Payload:

- `raw_script`
- `project_kind`
- `preserve_original`
- `detect_speakers`
- `suggest_pronunciations`
- `suggest_styles`
- `max_segment_length`

## Phase 2: Safe Import Preview

Do not write AI prep results directly into the project without review.

Add a preview model:

- proposed sections
- proposed segments
- speaker guesses
- confidence labels
- warnings

Routes:

- `POST /api/script-prep/preview`
- `POST /api/projects/{id}/script-prep/apply`

Store prep preview in:

- `script_prep_jobs`
  - `id`
  - `project_id`
  - `raw_script_hash`
  - `result_json`
  - `status`
  - timestamps

## Phase 3: Frontend UI

Add components:

- `ScriptPrepDialog.tsx`
- `ScriptPrepPreview.tsx`
- `SpeakerCandidateMapper.tsx`
- `PronunciationCandidateList.tsx`
- `StyleSuggestionList.tsx`

Workflow:

1. Paste/import manuscript.
2. Select project type.
3. Run prep.
4. Review proposed structure.
5. Map speakers to cast profiles or create profiles.
6. Accept pronunciation entries.
7. Apply selected segments to project.

## Phase 4: Integration With Cast and Dictionary

After cast/dictionary features exist:

- Convert accepted speaker candidates into cast profiles.
- Convert accepted pronunciation candidates into dictionary entries.
- Apply suggested style presets to sections/segments.
- Flag low-confidence speaker detection for manual review.

## Phase 5: Long Manuscript Handling

Large manuscripts need chunking:

- Split input by headings or size.
- Prep chunks separately.
- Reconcile speaker names and section structure.
- Show progress through job center.

Avoid sending excessively large scripts in one request.

## Technical Risks

- AI prep can hallucinate structure or speakers. Always use review-before-apply.
- The model may alter source text. Keep original text hash and compare segment text before applying.
- Long scripts can exceed context limits or create slow jobs. Chunking is required for real books.

## Testing Plan

Backend:

- Response schema validation tests.
- Apply-preview transaction tests.
- Source text preservation tests.

Frontend:

- Preview/apply flow.
- Candidate accept/reject flow.
- Playwright flow with sample audiobook and dialogue script.

## Exit Criteria

- A creator can import raw text, receive a structured project draft, review AI suggestions, and apply only accepted sections, segments, speakers, pronunciations, and styles.

