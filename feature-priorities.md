# Feature Priorities

## Brief Evaluation Summary

Gemini Voice Library already has unusually strong breadth for a local-first voice tool: stock voice browsing, AI casting, TTS generation, multi-speaker dialogue, preset management, history, backup/restore, key rotation, onboarding, and a polished React UI. The biggest opportunities are no longer basic feature coverage. They are workflow depth, operational visibility, and resilience.

The codebase already contains several strong foundations that are underused today: a WebSocket progress channel in `api.ts`, backend progress events in `backend/internal/handler/ws_progress.go`, an OpenAI TTS client in `backend/internal/openai/client.go`, rich preset metadata/versioning in the preset store, and a Script Reader that is powerful but mostly ephemeral because it only persists recent scripts in `localStorage`. That makes the best next investments very clear.

Ranking below balances user value, business impact, implementation complexity, and technical risk.

## Stack-Ranked Recommendations

### 1. Real-Time Job Center and Truthful Progress UI

**Problem**

Long-running work is still opaque in the UI. The backend already emits progress events for TTS jobs, but the frontend does not appear to consume the WebSocket progress stream. The current preset save flow in `App.tsx` uses simulated progress labels instead of real job state, which lowers user trust and encourages duplicate clicks.

**Proposed solution**

Create a global Job Center that consumes `connectProgress()` from `api.ts` and shows live status for TTS generation, preset saves, headshot generation, script formatting, imports, and any future batch jobs. Surface progress in three places: inline on the active control, as a persistent jobs drawer, and as lightweight completion/error toasts.

**Impact**

High. This improves perceived speed, trust, and supportability with relatively contained scope. It also unlocks more ambitious async features later.

**Effort**

Medium. Core plumbing already exists, but job identifiers and event coverage need to be standardized across more endpoints.

**Risks/dependencies**

Requires a consistent backend job lifecycle, better correlation between request/response and job IDs, and reconnect-safe frontend state handling.

### 2. Persistent Script Projects and Batch Rendering

**Problem**

The Script Reader is one of the strongest parts of the app, but it is still an advanced scratchpad. `ScriptReaderModal.tsx` keeps only `recentScripts` in `localStorage`, which is not enough for real production workflows such as podcasts, ads, tutorials, or dialogue-heavy content. Users cannot organize scripts into reusable projects, save voice assignments, or render multiple segments in one pass.

**Proposed solution**

Add backend-backed Script Projects with saved drafts, scene/segment organization, stock/custom voice assignments, accent settings, and batch render/export. Start with a simple project model: project, segments, selected voices, notes, and last rendered outputs. Then add batch export for WAV files and optional zip packaging.

**Impact**

Very high. This turns the app from a discovery-and-preview tool into a repeatable content production workspace.

**Effort**

High. It needs new storage, APIs, UI states, and likely async job support for batch work.

**Risks/dependencies**

Depends on the progress/job system above for a good UX. Also increases storage complexity, migration needs, and file management concerns.

### 3. Multi-Provider TTS with Automatic Failover

**Problem**

The backend already supports OpenAI TTS and the frontend API supports a `provider` field, but the visible product remains effectively Gemini-only. That leaves the app exposed to provider outages, rate limits, and single-vendor constraints even though the codebase already points toward a stronger architecture.

**Proposed solution**

Expose provider selection in Settings and advanced generation controls, support OpenAI key management alongside Gemini, and add optional fallback rules such as "retry on OpenAI if Gemini TTS fails". Make provider choice visible in history and presets so users can reproduce outputs reliably.

**Impact**

High. This improves reliability, expands the product story, and creates a stronger business/enterprise positioning.

**Effort**

Medium-high. Much of the backend is present, but the UX, settings model, provider-specific voice handling, and observability still need work.

**Risks/dependencies**

Voice parity is not one-to-one across providers. Costs, output differences, and provider-specific limitations need clear UX and documentation.

### 4. Unified Discovery Across Voices, Presets, and History

**Problem**

Discovery is split across several surfaces: basic filters, the AI Casting Director modal, command palette navigation, preset browsing, and history. Users can search exact text, but they cannot fluidly move from a natural-language need to a reusable voice, preset, or past render without hopping between views.

**Proposed solution**

Build a unified discovery layer that combines stock voices, custom presets, and relevant history entries. Extend the command palette and main search to support natural-language queries, "find similar" workflows for presets, and one-click actions like "reuse this in Script Reader" or "save this history item as a preset".

**Impact**

Medium-high. This shortens the path from idea to output and makes the existing feature set feel much more coherent.

**Effort**

Medium. Most data surfaces already exist, but the search model and UX need careful design.

**Risks/dependencies**

If AI search is added, caching and latency control matter. The UX must clearly distinguish direct filters from AI-assisted discovery.

### 5. Shareable Preset Bundles and Import Preview

**Problem**

Preset export/import already exists, but it is primarily a transport mechanism rather than a polished sharing workflow. There is no obvious preview, conflict handling, compatibility check, or "collection" experience for moving presets between machines or sharing them with teammates.

**Proposed solution**

Turn preset export/import into a first-class bundle workflow. Include metadata preview, artwork/audio packaging rules, schema versioning, duplicate handling, and optional collection manifests such as "Podcast Pack" or "Audiobook Narrators". Add a pre-import review screen instead of treating import as a blind file action.

**Impact**

Medium-high. This builds on the preset system, creates portability, and opens a path to curated packs or team workflows.

**Effort**

Medium. Core data models exist, but packaging format, validation, and conflict resolution need product polish.

**Risks/dependencies**

Needs schema/version discipline, file size limits, and decisions about whether bundled audio/headshots are embedded or referenced.

### 6. Production-Oriented Render QA and Audio Finishing

**Problem**

The app is strong at generation and playback, but weak at finishing. Users can preview and download WAV files, yet there are no controls for normalization, silence trimming, segment stitching, alternate takes, or focused QA loops after a render.

**Proposed solution**

Add an output finishing panel with silence trim, loudness normalization, clip renaming, take comparison, and segment-level re-render. For dialogue and script projects, add timeline-style segment lists so users can regenerate only problem lines instead of the full script.

**Impact**

Medium. This is less foundational than the items above, but it materially improves export quality and makes the app more usable for real content production.

**Effort**

Medium-high. Browser-side audio processing and QA workflows add complexity.

**Risks/dependencies**

Requires careful DSP choices, browser performance testing, and a UX that does not overwhelm casual users.

## Quick Wins

- Replace the simulated preset-save progress bar with real WebSocket-backed progress using the existing `connectProgress()` client and `ProgressHub` backend events.
- Add "Reuse in Script Reader" and "Save as Preset" actions inside `HistoryPanel.tsx` so history becomes an active workflow surface instead of a passive log.
- Persist the current Script Reader draft separately from `recentScripts` and offer restore-after-refresh behavior.
- Expose advanced provider/model controls only when corresponding API keys exist, starting with OpenAI as an opt-in advanced mode.
- Add import preview and duplicate-resolution options to preset import before any records are written.

## Longer-Term Opportunities

- Team and cloud sync for presets, scripts, and history once the local-first project model is mature.
- Curated preset packs or a small marketplace/gallery built on top of preset bundle sharing.
- Template intelligence that recommends voice, accent, and pacing presets based on content type such as podcast, audiobook, ad read, or tutorial.
- Quality benchmarking dashboards that compare providers, voices, prompt styles, and render outcomes over time.

## Top 3 Next Actions

1. Implement a thin end-to-end progress slice first: wire `connectProgress()` into a global jobs store, replace fake save progress in `App.tsx`, and show live status for TTS and preset/headshot generation.
2. Write a short RFC for Script Projects covering schema, routes, UI flow, and batch render semantics before building any persistence or queueing code.
3. Add an advanced provider abstraction plan that starts with OpenAI key management plus a provider selector in `AiTtsPreview.tsx` and Settings, then layers in automatic failover.