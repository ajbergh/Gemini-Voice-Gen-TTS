# Remove OpenAI — Cleanup Plan

**Date:** 2026-04-25  
**Goal:** Strip every OpenAI API dependency from product code, making this a Gemini-only application.

---

## Motivation

The app was originally built for Gemini TTS only. Plan 10 added an OpenAI TTS path as a multi-provider experiment (fallback rendering, provider voice mappings, cross-provider A/B comparison). That work is now explicitly out of scope. Keeping the OpenAI client, key management UI, provider registry entry, and routing branches adds dead maintenance surface, confuses settings UX, and risks future regressions when Gemini API contracts change.

---

## Decision Log

| Decision | Choice | Reasoning |
|---|---|---|
| Remove `backend/internal/openai` package | **Delete** | Dead code once routing removed |
| Keep fallback provider/model mechanism | **Keep, Gemini-scoped only** | Useful for flash→pro retry within Gemini; remove the cross-provider path |
| Keep `provider_voice_mappings` table | **Deprecate routes, keep table** | Existing schema migration won't break; routes removed; table is inert |
| Keep `fallback_provider` / `fallback_model` DB columns | **Keep** | Non-destructive; scoped to Gemini model IDs going forward |
| Rename `onOpenAiCasting` prop | **Rename to `onAiCasting`** | Misleading — the VoiceFinder is Gemini-powered; cosmetic but clarifying |
| Keep `ProviderInfo` / provider registry concept | **Simplify to Gemini-only** | Remove the OpenAI registry entry; keep `GET /api/providers` for Gemini metadata |

---

## Full Inventory of OpenAI Touchpoints

### Backend — Delete entirely

| Path | What |
|---|---|
| `backend/internal/openai/client.go` | Entire OpenAI TTS package |
| `backend/internal/openai/` directory | Package directory |

### Backend — Modify (surgical edits)

| File | Change |
|---|---|
| `backend/internal/handler/api_batch.go` | Remove `import openai`; remove `case "openai":` in `generateProviderTTS()`; simplify `generateWithFallback()` to Gemini-only; simplify `normalizeProvider()` (all unknown providers map to gemini); remove cross-provider voice mapping lookup in `resolveProviderVoice()`; simplify `defaultModelForProvider()` and `modelCompatibleWithProvider()` |
| `backend/internal/handler/api_voices.go` | Remove `import openai`; remove `if req.Provider == "openai"` branch in `GenerateTTS()` — always route to Gemini |
| `backend/internal/handler/api_keys.go` | Remove `import openai`; remove `case "openai":` in `TestKey()` handler; Gemini-only key test remains |
| `backend/internal/handler/api_providers.go` | Remove the entire OpenAI `ProviderInfo{}` struct literal from the `registry` slice; remove `normalizeProvider()` call in voice-mapping handlers (or keep for robustness) |
| `backend/internal/gemini/types.go` | Update `Provider` field comment: remove `"openai"` mention, change to `// "gemini" (default) — this application is Gemini-only` |

### Backend — Tests

| File | Change |
|---|---|
| `backend/internal/handler/api_providers_test.go` | Update `TestProvidersHandlerListProviders` — assert only `"gemini"` in response, remove `"openai"` assertion; update voice-mapping test to use Gemini→Gemini model mapping instead of Gemini→OpenAI |
| `backend/internal/handler/api_batch_test.go` | Remove `TestResolveProviderAndModel_CrossProvider` (or adapt): remove `openAIProvider := "openai"` fixtures; replace with Gemini model-override test if coverage value is preserved |
| `backend/internal/store/projects_test.go` | Remove `fallbackProvider := "openai"` test fixture; replace with `"gemini"` as fallback_provider if the fallback-cascade logic is still tested |
| `backend/internal/store/provider_mappings_test.go` | Rewrite tests to not reference `"openai"` as target provider; test Gemini-to-Gemini mapping scenario, or remove tests if the routes are removed |

### Backend — Routes to remove

| Route | Handler | Reason |
|---|---|---|
| `GET /api/provider-voice-mappings` | `ProvidersHandler.ListProviderVoiceMappings` | No cross-provider use case remains |
| `POST /api/provider-voice-mappings` | `ProvidersHandler.UpsertProviderVoiceMapping` | Ditto |
| `DELETE /api/provider-voice-mappings/{id}` | `ProvidersHandler.DeleteProviderVoiceMapping` | Ditto |

The `provider_voice_mappings` SQLite table itself is kept (no destructive migration needed). Routes are simply de-registered in `server/routes.go`.

### Frontend — Components

| File | Change |
|---|---|
| `components/SettingsModal.tsx` | Remove entire OpenAI API Key section: state vars `openaiKey`, `showOpenaiKey`, `savingOpenai`, `testingOpenai`, `deletingOpenai`, `openaiTestResult`; handlers `handleSaveOpenai`, `handleTestOpenai`, `handleDeleteOpenai`; computed `hasOpenaiKey`; the UI block (lines ~420–480) with the OpenAI logo SVG, input, test/delete buttons, and platform link |
| `components/FilterBar.tsx` | Rename prop `onOpenAiCasting` → `onAiCasting` in interface and usage |
| `components/NavigationSidebar.tsx` | Rename prop `onOpenAiCasting` → `onAiCasting` in interface and usage |
| `components/PresetGrid.tsx` | Rename prop `onOpenAiCasting` → `onAiCasting` in interface and usage |
| `App.tsx` | Update all 5 occurrences of `onOpenAiCasting={...}` → `onAiCasting={...}` |
| `components/ProjectWorkspace.tsx` | Update provider input `placeholder="e.g. openai"` → `placeholder="e.g. gemini"`; remove or update UI copy that implies multi-provider selection; simplify fallback provider field label to clarify it is Gemini-internal fallback |

### Frontend — `api.ts`

| Symbol | Change |
|---|---|
| `generateTts()` | Remove `provider?: string` parameter; remove `if (provider) body.provider = provider;` line |
| `ProviderVoiceMapping`, `UpsertProviderVoiceMappingInput` imports | Remove if provider mapping routes are removed |
| `listProviderVoiceMappings()`, `upsertProviderVoiceMapping()`, `deleteProviderVoiceMapping()` | Remove these three functions |
| `listProviders()` | Keep — still useful for the Gemini provider metadata used in settings and project workspace dropdowns |

### Frontend — `types.ts`

| Symbol | Change |
|---|---|
| `ProviderCapabilities`, `ProviderModel`, `ProviderVoice`, `ProviderInfo` | Keep — still accurately describe the Gemini provider entry |
| `ProviderVoiceMapping`, `UpsertProviderVoiceMappingInput` | Remove if provider mapping routes are removed |
| `fallback_provider`, `fallback_model` on `ScriptProject`, `ScriptSegment`, `Client` | Keep — now semantically "Gemini model fallback" rather than "cross-provider fallback"; update inline comments accordingly |

### Docs to update

| File | Update |
|---|---|
| `docs_internal/implementation-progress-status.md` | Mark Plan 10 Phase 4 (fallback/OpenAI) as superseded by this cleanup; note OpenAI removal; update "Not yet done" section for Plan 10 to remove Phase 6 |
| `docs_internal/implementation-plan-10-provider-model-strategy.md` | Add a header note that the multi-provider strategy was revised to Gemini-only; strike-through or archive Phase 5 OpenAI path and Phase 6 A/B comparison |
| `docs_internal/implementation-plan-14-production-settings-and-defaults.md` | Remove "OpenAI primary key" and "OpenAI key pool" bullet points from planned settings UI |
| `docs_internal/audiobook-voiceover-enhancement-ideas.md` | Remove the paragraph mentioning the OpenAI TTS client path |
| `.github/copilot-instructions.md` | Remove OpenAI from tech stack section; update "No external state management" or backend patterns to clarify Gemini-only |

---

## Phase Plan

> **Status:** ALL PHASES COMPLETE (2026-04-25)

### Phase 1 — Backend: Remove the OpenAI package and handler branches

1. Delete `backend/internal/openai/client.go` and remove the directory.
2. In `api_batch.go`:
   - Remove `import openai`.
   - In `generateProviderTTS()`: replace the `switch` with a direct Gemini path (`default:` only); remove the `case "openai":` block.
   - In `generateWithFallback()`: the function signature stays; behavior unchanged except `generateProviderTTS` now only calls Gemini.
   - In `normalizeProvider()`: add `case "openai":` that maps to `"gemini"` (graceful no-op for any existing DB rows that still have `provider = "openai"` — they silently render via Gemini).
   - In `resolveProviderVoice()`: remove the `FindProviderVoiceMapping` call and the `providerSupportsVoice` cross-provider check; simplify to always return the source voice for Gemini.
3. In `api_voices.go`: remove `import openai`; remove the `if req.Provider == "openai"` branch; always call the Gemini client.
4. In `api_keys.go`: remove `import openai`; remove `case "openai":` from `TestKey()`; leave the generic key fetch + validation structure intact for extensibility.
5. In `api_providers.go`: remove the OpenAI `ProviderInfo` struct from the `registry` slice.
6. In `api_providers.go` + `server/routes.go`: de-register the three `provider-voice-mappings` routes.
7. In `gemini/types.go`: update `Provider` field comment.

**Verification:** `go build -buildvcs=false ./...` must pass; `go test ./internal/handler ./internal/store ./internal/server` must pass.

---

### Phase 2 — Backend: Fix tests

1. `api_providers_test.go`: assert only `"gemini"` in provider list; rework voice-mapping test.
2. `api_batch_test.go`: remove OpenAI provider fixture tests; keep Gemini model-override test.
3. `store/projects_test.go`: change `fallbackProvider := "openai"` to `"gemini"` where fallback logic is being tested.
4. `store/provider_mappings_test.go`: rewrite to use Gemini→Gemini scenario, or remove entirely if the routes are gone.

**Verification:** `go test ./...` must pass with zero failures.

---

### Phase 3 — Frontend: Settings and prop rename

1. In `components/SettingsModal.tsx`:
   - Delete all state vars, handlers, and UI related to the OpenAI key section.
   - The Gemini key section, key pool, backup/restore, and other settings are unaffected.
2. Rename `onOpenAiCasting` → `onAiCasting` in:
   - `components/FilterBar.tsx` (interface + usage)
   - `components/NavigationSidebar.tsx` (interface + usage)
   - `components/PresetGrid.tsx` (interface + usage)
   - `App.tsx` (all 5 call sites)

**Verification:** `npx tsc --noEmit` must pass.

---

### Phase 4 — Frontend: api.ts, types.ts, and ProjectWorkspace cleanup

1. In `api.ts`:
   - Remove `provider` parameter from `generateTts()`.
   - Remove `listProviderVoiceMappings`, `upsertProviderVoiceMapping`, `deleteProviderVoiceMapping` functions.
   - Remove `ProviderVoiceMapping`, `UpsertProviderVoiceMappingInput` from imports.
2. In `types.ts`:
   - Remove `ProviderVoiceMapping` and `UpsertProviderVoiceMappingInput` interfaces.
3. In `components/ProjectWorkspace.tsx`:
   - Update provider input placeholder text.
   - Relabel "Fallback provider / model" UI to "Fallback Gemini model" or remove the fallback provider field entirely (keep only fallback model since we're Gemini-only).
   - Remove any explicit "openai" string literals from select options or placeholders.

**Verification:** `npx tsc --noEmit` must pass; `npm run build` must pass.

---

### Phase 5 — Docs update

Update the five doc files listed in the inventory above. This phase has no build verification requirement — it's documentation hygiene.

---

## Data Migration Notes

No destructive schema migration is needed or wanted.

- **Existing `segment_takes` rows with `provider = "openai"`**: These are historical data. They render fine as audit trail. The backend will no longer write new takes with `provider = "openai"`.
- **Existing `script_projects` / `script_segments` rows with `provider = "openai"` or `fallback_provider = "openai"`**: With `normalizeProvider("openai") → "gemini"` in Phase 1, any segment still carrying `provider = "openai"` in the DB will silently render via Gemini. No data loss.
- **Existing `provider_voice_mappings` rows**: Routes are removed so the UI can't manage them, but rows stay in SQLite. If cleanup is desired, a one-off SQL statement can delete them:
  ```sql
  DELETE FROM provider_voice_mappings WHERE target_provider = 'openai';
  ```
  This is optional and can be run manually; no migration file needed.

---

## Files to Delete

| Path | Action |
|---|---|
| `backend/internal/openai/client.go` | Delete |
| `backend/internal/openai/` | Remove directory |

---

## Files Modified (summary)

**Backend (Go):**
- `backend/internal/handler/api_batch.go`
- `backend/internal/handler/api_voices.go`
- `backend/internal/handler/api_keys.go`
- `backend/internal/handler/api_providers.go`
- `backend/internal/server/routes.go`
- `backend/internal/gemini/types.go`
- `backend/internal/handler/api_providers_test.go`
- `backend/internal/handler/api_batch_test.go`
- `backend/internal/store/projects_test.go`
- `backend/internal/store/provider_mappings_test.go`

**Frontend (TypeScript/TSX):**
- `components/SettingsModal.tsx`
- `components/FilterBar.tsx`
- `components/NavigationSidebar.tsx`
- `components/PresetGrid.tsx`
- `components/ProjectWorkspace.tsx`
- `App.tsx`
- `api.ts`
- `types.ts`

**Docs:**
- `docs_internal/implementation-progress-status.md`
- `docs_internal/implementation-plan-10-provider-model-strategy.md`
- `docs_internal/implementation-plan-14-production-settings-and-defaults.md`
- `docs_internal/audiobook-voiceover-enhancement-ideas.md`
- `.github/copilot-instructions.md`

---

## Out of Scope

- Removing the `provider_voice_mappings` SQLite table or `019_provider_strategy.sql` migration (not worth the migration file churn; table is inert once routes are gone).
- Removing `fallback_provider` / `fallback_model` DB columns from projects, segments, and clients (kept for Gemini model fallback use case).
- Removing the `GET /api/providers` endpoint or `ProviderInfo` types (still useful for the Gemini registry metadata).
- Removing the `ProviderCapabilities`, `ProviderModel`, `ProviderVoice` TS types (they still accurately model Gemini).

---

## Exit Criteria

- `go test ./...` from `backend/` passes with zero failures.
- `npx tsc --noEmit` passes with zero errors.
- `npm run build` produces a clean bundle (large-chunk warning acceptable; no new errors).
- `GET /api/providers` returns exactly one provider: `gemini`.
- Settings modal shows only the Gemini API key section (no OpenAI block).
- Segment/project rendering always calls Gemini regardless of any `provider` value still in DB rows.
- No import of `openai` package anywhere in the Go build graph.
