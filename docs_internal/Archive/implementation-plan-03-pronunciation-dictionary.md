# Implementation Plan: Pronunciation Dictionary and Replacement Rules

## Related Enhancement

Pronunciation Dictionary and Replacement Rules.

## Current Foundations

- Script formatting and TTS prompt construction already transform user text before sending it to Gemini.
- Audio tags are inserted and highlighted in the Script Reader.
- Projects will provide a natural scope for dictionaries.
- Settings can later expose global dictionaries.

## Target Outcome

Creators can define how names, brands, acronyms, numbers, URLs, and unusual terms should be spoken. Rules can be global, project-specific, or client-specific, and the app applies them consistently before rendering.

## Phase 1: Data Model

Add migrations:

- `pronunciation_dictionaries`
  - `id`
  - `scope` (`global`, `project`, `client`)
  - `project_id`
  - `client_id`
  - `name`
  - `description`
  - `is_active`
  - timestamps

- `pronunciation_entries`
  - `id`
  - `dictionary_id`
  - `written_form`
  - `spoken_form`
  - `match_type` (`exact`, `case_insensitive`, `whole_word`, `regex`)
  - `language_code`
  - `accent_id`
  - `notes`
  - `sort_order`
  - `is_active`
  - timestamps

Indexes:

- `dictionary_id`
- `written_form`
- `scope`
- `project_id`

## Phase 2: Backend Transformation Service

Add package:

- `backend/internal/pronunciation`

Core function:

- `ApplyDictionary(text string, entries []Entry) (TransformedText, []AppliedRule, []Warning)`

Rules:

- Whole-word matching by default.
- Explicit `regex` only for advanced entries.
- Apply entries in `sort_order`, then longer `written_form` before shorter terms.
- Preserve audio tags.
- Preserve speaker labels in dialogue mode.
- Return applied spans for UI preview.

Routes:

- `GET /api/pronunciation/dictionaries`
- `POST /api/pronunciation/dictionaries`
- `GET /api/pronunciation/dictionaries/{id}`
- `PUT /api/pronunciation/dictionaries/{id}`
- `DELETE /api/pronunciation/dictionaries/{id}`
- `POST /api/pronunciation/dictionaries/{id}/entries`
- `PUT /api/pronunciation/entries/{id}`
- `DELETE /api/pronunciation/entries/{id}`
- `POST /api/pronunciation/preview`
- `POST /api/pronunciation/import`
- `GET /api/pronunciation/export`

Preview payload:

- `project_id`
- `text`
- `language_code`
- `accent_id`

## Phase 3: Render Pipeline Integration

Integrate dictionary application before:

- single segment render
- batch render
- line-level re-render
- multi-speaker dialogue render

Store render metadata:

- dictionary IDs used
- dictionary entry version/hash
- applied replacement count
- warnings

Important rule:

- Store original script text unchanged. Apply pronunciation transformations only to the render payload.

## Phase 4: Frontend UI

Add components:

- `PronunciationPanel.tsx`
- `PronunciationEntryTable.tsx`
- `PronunciationPreviewDialog.tsx`
- `PronunciationInlineHighlight.tsx`

Project workspace:

- Highlight known dictionary terms in the editor.
- Highlight likely unknown candidates.
- Add context action: "Add pronunciation".
- Preview a selected word or sentence.

Settings:

- Manage global dictionaries.
- Import/export dictionaries.

## Phase 5: AI-Assisted Candidate Detection

Use the script prep flow to suggest:

- invented names
- uncommon capitalized terms
- acronyms
- URLs
- product names
- repeated unusual words

Keep suggestions separate from active entries until the user accepts them.

## Technical Risks

- Over-aggressive replacement can alter content incorrectly. Keep original text immutable and make substitutions previewable.
- Regex entries can create surprising replacements. Gate them behind an advanced toggle.
- Language/accent-specific entries need clear fallback order.

## Testing Plan

Backend:

- Unit tests for exact, case-insensitive, whole-word, and regex replacements.
- Tests that audio tags and speaker labels are preserved.
- Tests for dictionary scope resolution order.

Frontend:

- Entry CRUD smoke tests.
- Preview transformation tests.
- Playwright flow: add term, preview pronunciation, render segment, verify metadata records dictionary use.

## Exit Criteria

- A project can define pronunciation rules, preview them, apply them during rendering, and export/import them without modifying original manuscript text.

