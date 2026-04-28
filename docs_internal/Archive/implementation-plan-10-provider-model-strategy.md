# Implementation Plan: Provider and Model Strategy

> **REVISION NOTE (2026-04-25):** The multi-provider (Gemini + OpenAI) strategy described in this plan was superseded. This application is now **Gemini-only**. All OpenAI code has been removed. See `remove-openai-plan.md` for the complete removal audit. Phase 4 (fallback rules) is retained for Gemini flash→pro model switching. Phase 6 (provider comparison) is permanently deferred.

## Related Enhancement

Provider and Model Strategy Per Project.

Merged UI/UX items:
- Trust and reproducibility indicators.
- Provider-focused part of production settings.

## Current Foundations

- `gemini.TTSRequest` already accepts `provider` and `model`.
- `VoicesHandler.GenerateTTS` can call Gemini or OpenAI.
- `backend/internal/openai/client.go` exists.
- API key storage and key-pool endpoints accept arbitrary provider names.
- Settings UI currently focuses on Gemini key management and Gemini key pools.

## Target Outcome

Provider and model selection become first-class production settings. Users can set defaults, use fallback rules, compare providers, and understand which provider/model produced each approved take.

## Phase 1: Provider Registry

Add a backend provider registry:

- Provider ID
- Display name
- Supported capabilities:
  - single speaker TTS
  - multi-speaker TTS
  - streaming
  - language selection
  - voice list
  - PCM output
- Supported models
- Supported voices
- Default model
- Key validation strategy

Route:

- `GET /api/providers`

Do not hardcode provider-specific UI details in many components. Fetch provider metadata and render controls from it where possible.

## Phase 2: Settings UI for Multiple Providers

Update `SettingsModal.tsx` or replace with a settings workspace:

- Gemini key
- OpenAI key
- key pool per provider
- test key per provider
- active/inactive provider status

Frontend API already has generic `storeApiKey(provider, key)`, but UI needs provider-specific sections.

## Phase 3: Project and Segment Defaults

Use project and segment fields:

- `provider`
- `model`
- `language_code`
- optional `fallback_provider`
- optional `fallback_model`

Resolution order:

1. segment override
2. section override, if implemented
3. project default
4. client default
5. global settings default
6. provider registry default

## Phase 4: Fallback Rules

Add project/global fallback settings:

- retry same provider on transient 5xx
- fallback to alternate provider on overload
- never fallback without user approval
- fallback only for draft renders, not approved re-renders

Important:

- Providers do not have equivalent voices. OpenAI voice names are not Gemini voice names. Fallback must show the mapped provider voice or require a project-level mapping.

Add `provider_voice_mappings`:

- `id`
- `project_id`
- `source_provider`
- `source_voice`
- `target_provider`
- `target_voice`
- notes

## Phase 5: Render Metadata and Reproducibility

Store on every take/history/export:

- provider
- model
- provider voice
- app voice or preset ID
- language
- accent
- style ID/version/hash
- dictionary hash
- prompt hash
- render timestamp

UI badges:

- Provider
- Model
- Voice
- Accent/language
- Dictionary version
- Settings changed warning

## Phase 6: Provider Comparison

Add comparison action:

- Render the same segment with two provider/model settings.
- Create separate takes.
- Display as A/B in take compare panel.

## Technical Risks

- OpenAI and Gemini voice systems are not equivalent. Avoid pretending fallback output will match exactly.
- Multi-speaker and streaming capabilities differ by provider. Controls must disable unsupported combinations.
- Cost estimates require provider pricing data that can change. Keep cost reporting optional and manually configurable unless a reliable source is added.

## Testing Plan

Backend:

- Provider registry tests.
- Key test path for Gemini and OpenAI.
- Fallback decision tests with fake clients.
- Metadata persistence tests.

Frontend:

- Settings UI tests for provider sections.
- Disabled unsupported controls tests.
- Playwright flow: add OpenAI key, select OpenAI provider, render, verify metadata badge.

## Exit Criteria

- Users can configure Gemini and OpenAI, choose provider/model at project and segment level, and see exact provider/model metadata on takes and history.

