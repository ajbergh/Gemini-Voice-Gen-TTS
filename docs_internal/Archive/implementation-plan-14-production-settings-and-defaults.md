# Implementation Plan: Production Settings and Defaults

## Related Enhancement

Settings Reorganized Around Production Needs.

This is a unique cross-cutting UI/UX plan because settings will govern providers, render defaults, export profiles, pronunciation dictionaries, storage, backup, accessibility, and appearance.

## Current Foundations

- `SettingsModal.tsx` handles Gemini API key, Gemini key pool, audio cache, backup, and restore.
- `api.ts` already supports generic key storage and cache/backup APIs.
- Theme and appearance options are split between App state, backend config, and sidebar controls.

## Target Outcome

Settings become a production control center with clear categories. Technical controls remain available, but everyday creator defaults are easier to find and apply.

## Phase 1: Settings Information Architecture

Replace single long modal content with grouped settings:

- Providers and keys
- Render defaults
- Export profiles
- Pronunciation dictionaries
- Storage and cache
- Backup and restore
- Accessibility and appearance

Implementation options:

- Keep `SettingsModal.tsx` but add internal tabs.
- Or create `SettingsWorkspace.tsx` if the content becomes too large.

Prefer tabs in v1 to reduce navigation changes.

## Phase 2: Backend Config Schema

Continue using `config` table for simple key/value settings, but define typed keys in frontend/backend constants.

Candidate keys:

- `default_provider`
- `default_model`
- `default_language_code`
- `default_streaming_enabled`
- `default_batch_concurrency`
- `default_retry_count`
- `continue_batch_on_error`
- `default_export_profile_id`
- `last_open_project_id`
- `appearance_theme`
- `appearance_accent_color`
- `appearance_high_contrast`

Add helper methods:

- `GetConfigValue`
- `SetConfigValue`
- `GetTypedConfig`

## Phase 3: Providers and Keys

Move provider key UI here:

- Gemini primary key.
- Gemini key pool.
- Test button for Gemini key.

Show provider capability badges:

- single-speaker
- multi-speaker
- streaming
- languages
- fallback eligible

## Phase 4: Render Defaults

Controls:

- provider
- model
- language auto-detect or default language
- streaming default
- retry count
- batch concurrency
- fallback behavior

Rules:

- Project settings override global defaults.
- Segment settings override project defaults.
- Unsupported provider/model combinations are disabled.

## Phase 5: Export Profiles and Dictionaries

Link to profile managers:

- Export profile list and editor.
- Global pronunciation dictionaries.
- Import/export dictionaries.

Settings should not duplicate full project-specific editing but should manage global reusable defaults.

## Phase 6: Storage, Backup, and Cache

Keep current functions:

- cache stats
- clear cache
- download backup
- restore backup

Add:

- export cache stats
- old job cleanup
- old export cleanup
- audio cache directory display remains read-only unless there is a safe config story.

## Phase 7: Accessibility and Appearance

Move sidebar-only appearance controls into settings too:

- theme
- accent color
- high contrast
- reduced motion
- compact/comfortable density default

Keep sidebar quick controls if useful, but settings should be the complete source.

## Technical Risks

- Config stored as strings can become messy. Define typed parse/serialize helpers.
- Settings can become another overloaded modal. Use tabs and focused subcomponents.
- Provider settings can be confusing if provider capability differences are not visible.

## Testing Plan

Backend:

- Typed config parse tests.
- Config default tests.

Frontend:

- Settings tab navigation tests.
- Provider key add/test/delete flow.
- Render default persistence.
- Appearance persistence.

Playwright:

- Open Settings, switch tabs, modify defaults, reload, verify persistence.

## Exit Criteria

- A creator can configure provider keys, production defaults, export profiles, global dictionaries, cache, backup, and accessibility settings without reading technical implementation details.

