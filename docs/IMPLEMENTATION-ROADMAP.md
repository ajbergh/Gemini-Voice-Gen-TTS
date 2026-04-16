# Gemini Voice Library — Implementation Roadmap

A phased plan for implementing the remaining improvements from [IMPROVEMENTS.md](./IMPROVEMENTS.md). Each phase groups related features by theme, dependency order, and impact. Items already shipped in the Gemini 3.1 Flash TTS upgrade are excluded.

---

## Status Overview

| Phase | Theme | Items | Status |
|-------|-------|-------|--------|
| 1 | Quick Wins & Polish | 10 | ✅ Complete |
| 2 | Script Reader & TTS Workflow | 9 | ✅ Complete |
| 3 | Preset & Data Management | 10 | ✅ Complete |
| 4 | Backend Infrastructure | 7 | ✅ Complete |
| 5 | Navigation & Layout Overhaul | 6 | ✅ Complete |
| 6 | Advanced Features & Mobile | 22 | 🔶 In Progress |

---

## Phase 1 — Quick Wins & Polish ✅ Complete

**Goal:** Ship high-impact, low-effort improvements that immediately improve daily UX.

**Prerequisites:** None — all items are independent and can be implemented in any order.

| # | Ref | Feature | Scope | Complexity | Status |
|---|-----|---------|-------|------------|--------|
| 1.1 | U13 / Q2 | **Live character count** — Show character count and estimated audio duration below the script input | Frontend | Low | ✅ |
| 1.2 | F19 / Q3 | **Favorite voices** — Star/heart toggle on stock voice cards for quick access; persist via backend | Frontend + Backend | Low | ✅ |
| 1.3 | F17 / Q4 | **Preset duplication** — One-click duplicate button on preset cards | Frontend + Backend | Low | ✅ |
| 1.4 | U25 / Q5 | **Toast notifications** — Dismissible toast system for success/error states (save, delete, TTS complete) | Frontend | Low | ✅ |
| 1.5 | U5 / Q6 | **Keyboard shortcut overlay** — Press `?` to show a shortcut cheat sheet modal | Frontend | Low | ✅ |
| 1.6 | U24 / Q7 | **Loading skeleton screens** — Replace spinners with skeleton placeholders during TTS generation and data fetching | Frontend | Low | ✅ |
| 1.7 | F6 | **Playback speed control** — 0.5×–2× speed options for TTS playback using Web Audio API `playbackRate` | Frontend | Low | ✅ |
| 1.8 | U23 | **Preset preview tooltip** — Hover tooltip showing truncated system instruction on preset cards | Frontend | Low | ✅ |
| 1.9 | F32 / Q10 | **Model selection toggle** — UI dropdown to choose TTS model per generation (3.1 Flash vs 2.5 Flash) | Frontend + Backend | Low–Med | ✅ |
| 1.10 | U12 | **Animated card transitions** — Smoother entry/exit animations when filtering changes the visible card set | Frontend | Low | ✅ |

**Implementation Notes:**
- Items 1.1–1.8 are purely additive and can be developed in parallel.
- Item 1.2 (favorites) requires a new `favorites` table or column in the backend store and a `GET/POST /api/favorites` endpoint.
- Item 1.3 (preset duplication) can reuse the existing `POST /api/presets` endpoint with cloned data.
- Item 1.4 (toasts) should be built as a reusable `<ToastProvider>` context so all subsequent phases can use it.
- Item 1.9 (model selection) requires passing `model` through the TTS request types and making the model configurable per request in the Go client.

---

## Phase 2 — Script Reader & TTS Workflow ✅ Complete

**Goal:** Make the Script Reader a more powerful content creation tool with better authoring, formatting, and playback features.

**Prerequisites:** Phase 1 recommended (toast notifications, skeleton screens, playback speed control enhance these features).

| # | Ref | Feature | Scope | Complexity | Status |
|---|-----|---------|-------|------------|--------|
| 2.1 | F9 / U14 | **Script templates & prompt library** — Pre-loaded templates (podcast, audiobook, commercial, etc.) selectable from a dropdown | Frontend | Low–Med | ✅ |
| 2.2 | U15 | **Syntax highlighting for audio tags** — Color-code `[whispers]`, `[excited]`, `[pause]` tags in the script textarea (use a `contentEditable` div or overlay) | Frontend | Med | ✅ |
| 2.3 | U16 | **Drag-and-drop script files** — Drop `.txt` or `.md` files onto the Script Reader to import text | Frontend | Low | ✅ |
| 2.4 | U18 | **Recent scripts** — Remember last 5 scripts with a dropdown to re-select; persist in backend config or localStorage | Frontend (+ Backend optional) | Low | ✅ |
| 2.5 | F14 | **Language auto-detection** — Complete the partial implementation: auto-detect script language and pre-select the matching `languageCode` | Frontend + Backend | Med | ✅ |
| 2.6 | F12 | **Smart script formatter** — Use Gemini to auto-format plain text into optimal TTS prompt structure (Audio Profile → Scene → Director's Notes → Transcript) | Frontend + Backend | Med | ✅ |
| 2.7 | F8 | **Voice comparison mode** — Generate the same text with 2–3 voices side-by-side for A/B comparison; show waveforms + playback controls | Frontend + Backend | Med–High | ✅ |
| 2.8 | F1 | **Streaming TTS playback** — Stream audio chunks as they arrive from the Gemini API; play while generating | Frontend + Backend | High | ✅ |
| 2.9 | F13 | **Voice similarity search** — "Find voices similar to X" using characteristic vectors or embeddings from the voice analysis data | Frontend + Backend | Med–High | ✅ |

**Implementation Notes:**
- Items 2.1–2.4 are lightweight and can be done first as a batch.
- Item 2.2 (syntax highlighting) is the trickiest in this batch — consider a `<div contentEditable>` overlay approach or a lightweight editor like CodeMirror with a custom TTS tag language.
- Item 2.5 (language auto-detection) can use the Gemini text model to detect language from the first ~200 characters of input, or a lightweight client-side library.
- Item 2.6 (smart formatter) adds a new backend endpoint `POST /api/voices/format-script` calling Gemini with a formatting system prompt.
- Item 2.8 (streaming) is the most complex — requires Server-Sent Events or WebSocket on the Go backend, chunked base64 audio decoding, and incremental Web Audio buffer queueing on the frontend.

---

## Phase 3 — Preset & Data Management ✅ Complete

**Goal:** Give users better tools to organize, search, and manage their presets and generation history.

**Prerequisites:** Phase 1 (toast notifications, skeleton screens).

| # | Ref | Feature | Scope | Complexity | Status |
|---|-----|---------|-------|------------|--------|
| 3.1 | F15 | **Preset folders / tags** — Colored tags (Podcast, Commercial, Character) on presets with tag-based filtering | Frontend + Backend | Med | ✅ |
| 3.2 | F16 | **Preset import / export** — Export presets as JSON; import from file with validation | Frontend + Backend | Med | ✅ |
| 3.3 | U21 | **Preset color coding** — Assign a color accent to each preset for visual identification in grid and carousel | Frontend + Backend | Low | ✅ |
| 3.4 | U22 | **Inline preset editing** — Edit name and system instruction directly on the card without opening a modal | Frontend | Med | ✅ |
| 3.5 | U19 | **Preset card audio waveform** — Mini waveform visualization on each preset card using cached sample audio | Frontend | Med | ✅ |
| 3.6 | U20 | **Drag-to-reorder presets** — Manual drag-and-drop sorting in grid view; persist order in backend | Frontend + Backend | Med | ✅ |
| 3.7 | F21 | **History search & filtering** — Full-text search, date range picker, voice filter, generation type filter | Frontend + Backend | Med | ✅ |
| 3.8 | F22 | **History export** — Export generation history as CSV or JSON | Frontend + Backend | Low | ✅ |
| 3.9 | F23 | **Audio cache management** — Show total cache size in Settings, per-entry delete, "Clear all cache" button | Frontend + Backend | Low–Med | ✅ |
| 3.10 | F20 | **Preset versioning** — Track edit history for presets; allow reverting to previous system instructions | Frontend + Backend | Med–High | ✅ |

**Implementation Notes:**
- Item 3.1 (tags) requires a `preset_tags` table or a `tags` JSON column on `custom_presets`. Add `GET /api/presets/tags` and tag filter params.
- Item 3.2 (import/export) can serialize presets to a JSON schema including metadata, system instruction, and optionally base64-encoded sample audio.
- Item 3.6 (drag-to-reorder) needs a `sort_order` column on `custom_presets` and a `PATCH /api/presets/reorder` endpoint. Use `@dnd-kit/core` or Framer Motion's `Reorder` component.
- Item 3.7 (history search) requires backend support for `?q=`, `?from=`, `?to=`, `?voice=`, `?type=` query params on `GET /api/history`.
- Item 3.10 (versioning) requires a `preset_versions` table storing snapshots on each edit.

---

## Phase 4 — Backend Infrastructure ✅ Complete

**Goal:** Improve reliability, scalability, and deployment options for the Go backend.

**Prerequisites:** None — infrastructure work is independent. Best done before Phase 5/6 to support their needs.

| # | Ref | Feature | Scope | Complexity | Status |
|---|-----|---------|-------|------------|--------|
| 4.1 | F27 | **Rate limiting** — Configurable per-endpoint rate limiting (token bucket) to stay within Gemini API quotas | Backend | Med | ✅ |
| 4.2 | F29 | **Backup & restore** — One-click SQLite backup/restore from Settings; use `VACUUM INTO` for safe hot backup | Backend + Frontend | Low–Med | ✅ |
| 4.3 | F30 / Q9 | **Docker support** — Multi-stage `Dockerfile` and `docker-compose.yml` for containerized deployment | DevOps | Med | ✅ |
| 4.4 | F28 | **API key rotation** — Support multiple API keys with automatic round-robin or failover when one hits rate limits | Backend + Frontend | Med | ✅ |
| 4.5 | F31 | **WebSocket progress** — Push real-time TTS generation progress to the frontend via WebSocket | Backend + Frontend | High | ✅ |
| 4.6 | F33 | **OpenAI TTS fallback** — Optional OpenAI TTS provider as a secondary backend; add provider selection in Settings | Backend + Frontend | High | ✅ |
| 4.7 | F25 | **Undo/redo for TTS settings** — Undo stack for last N generation parameter sets (voice, text, style) | Frontend | Med | ✅ |

**Implementation Notes:**
- Item 4.1 (rate limiting) should use `golang.org/x/time/rate` or a simple token-bucket middleware. Configure limits per route group (`/api/voices/tts/*` vs `/api/voices/recommend`).
- Item 4.2 (backup) can use SQLite's `VACUUM INTO ?` for a consistent hot backup to a user-chosen path. Add `POST /api/config/backup` and `POST /api/config/restore`.
- Item 4.3 (Docker) should use a multi-stage build: stage 1 builds the Go binary with embedded frontend, stage 2 copies it into a minimal `scratch` or `alpine` image.
- Item 4.5 (WebSocket) is a prerequisite for streaming TTS (Phase 2, item 2.8). Consider implementing them together.
- Item 4.6 (OpenAI fallback) requires a provider abstraction layer in the backend so TTS calls can be routed to either Gemini or OpenAI based on configuration.

---

## Phase 5 — Navigation & Layout Overhaul ✅ COMPLETE

**Goal:** Restructure the app layout for better navigation, persistent playback, and power-user workflows.

**Prerequisites:** Phase 1 (toast notifications), Phase 3 (history/preset management improvements benefit from new layout).

| # | Ref | Feature | Scope | Complexity | Status |
|---|-----|---------|-------|------------|--------|
| 5.1 | U2 | **Persistent tab bar** — Mobile bottom tabs (Voices → Presets → Script Reader → History) | Frontend | Med–High | ✅ Done |
| 5.2 | U1 | **Sidebar navigation** — Collapsible sidebar on desktop; auto-collapse on mobile to bottom tabs | Frontend | High | ✅ Done |
| 5.3 | U4 | **Floating mini-player** — Persistent bottom audio player with AudioProvider context, progress bar, source badges | Frontend | Med–High | ✅ Done |
| 5.4 | U3 | **Split-pane Script Reader** — Resizable SplitPane: voice list on left, script editor on right (desktop); stacked on mobile | Frontend | High | ✅ Done |
| 5.5 | U6 | **Command palette** — `Ctrl+K` palette for quick actions: navigate sections, search voices/presets, toggle theme/view, open settings | Frontend | Med | ✅ Done |
| 5.6 | U30 | **Onboarding tour** — First-time guided walkthrough with step-by-step tooltips, localStorage-tracked completion | Frontend | Med | ✅ Done |

**Implementation Notes:**
- Items 5.1 and 5.2 are mutually exclusive layout strategies — choose one based on user feedback. A tab bar (5.1) is simpler and more mobile-friendly; a sidebar (5.2) is better for desktop power users. Could implement both with a responsive switch.
- Item 5.3 (mini-player) requires lifting audio playback state to a top-level `<AudioProvider>` context so playback persists across tab/section changes.
- Item 5.4 (split-pane) can use CSS Grid with a draggable divider or a library like `react-resizable-panels`.
- Item 5.5 (command palette) can use `cmdk` (a popular React command palette library) or a custom implementation.
- Item 5.6 (onboarding) should use localStorage to track first-visit state and a library like `react-joyride` for step-by-step tooltips.

---

## Phase 6 — Advanced Features & Mobile

**Goal:** Add sophisticated audio capabilities, advanced AI features, and optimize the mobile experience.

**Prerequisites:** Phases 1–4 recommended. Some items (F4, F5) depend on streaming and WebSocket infrastructure from Phases 2 and 4.

### Advanced Audio

| # | Ref | Feature | Scope | Complexity |
|---|-----|---------|-------|------------|
| 6.1 | F3 | **Audio format options** — MP3 and OGG export alongside WAV; bitrate/sample-rate controls in Settings | Frontend + Backend | Med |
| 6.2 | F4 | **Batch TTS generation** — Queue multiple text/voice pairs for bulk generation; download as ZIP | Frontend + Backend | High |
| 6.3 | F5 | **Audio trimming & editing** — Basic waveform editor for trimming, adjusting start/end, normalizing volume | Frontend | High |
| 6.4 | F7 | **Audio bookmarking** — Mark and name timestamps in generated audio for quick scrubbing | Frontend | Med |

### Advanced AI

| # | Ref | Feature | Scope | Complexity |
|---|-----|---------|-------|------------|
| 6.5 | F10 | **Voice cloning / fine-tuning** — Upload reference audio to create custom voice clones (when Gemini API supports it) | Frontend + Backend | High (API-dependent) |
| 6.6 | F18 | **Project workspaces** — Named project containers grouping presets, scripts, and generated audio with separate histories | Frontend + Backend | High |
| 6.7 | F24 | **Usage analytics dashboard** — Charts showing voice usage, generation counts over time, total audio generated | Frontend + Backend | Med |

### Visual & Cards

| # | Ref | Feature | Scope | Complexity | Status |
|---|-----|---------|-------|------------|--------|
| 6.8 | U7 | **Voice card hover preview** — Auto-play 2-second voice sample on hover (toggleable in Settings) | Frontend | Low–Med | ✅ Done |
| 6.9 | U8 | **Card detail expansion** — Inline expandable detail panel on voice cards with characteristics, sample player, quick TTS | Frontend | Med | ✅ Done |
| 6.10 | U9 | **Carousel pagination dots** — Position indicator dots below the 3D carousel | Frontend | Low | ✅ Done |
| 6.11 | U10 | **Grid density toggle** — Compact / comfortable / spacious grid density options | Frontend | Low | ✅ Done |
| 6.12 | U11 | **Voice card badges** — "New", "Popular", "AI Recommended", language flag badges on cards | Frontend | Low | ✅ Done |

### Mobile & Accessibility

| # | Ref | Feature | Scope | Complexity | Status |
|---|-----|---------|-------|------------|--------|
| 6.13 | U26 | **Micro-interactions** — Button ripples, card flip on save, subtle celebration animations | Frontend | Low–Med | ✅ Done |
| 6.14 | U27 | **Custom theme colors** — User-selectable accent color (blue, purple, green, rose, etc.) | Frontend | Low–Med | ✅ Done |
| 6.15 | U28 | **High-contrast mode** — Accessibility-focused theme with WCAG AAA contrast ratios | Frontend | Med | ✅ Done |
| 6.16 | U29 | **Glass morphism refinement** — Consistent blur values, better dark-mode contrast ratios | Frontend | Low | ✅ Done |
| 6.17 | U31 | **Bottom sheet modals on mobile** — Swipeable bottom sheets replacing standard modals on small screens | Frontend | Med | ✅ Done |
| 6.18 | U32 | **Touch gesture improvements** — Momentum swiping on carousel, pinch-to-zoom on waveforms | Frontend | Med | 🔲 |
| 6.19 | U33 | **PWA support** — `manifest.json`, service worker, offline cached voices for installable PWA | Frontend + Backend | Med–High | 🔲 |
| 6.20 | U34 | **Responsive filter drawer** — Slide-out filter drawer on mobile replacing multi-row filter bar | Frontend | Med | ✅ Done |
| 6.21 | U35 | **Landscape tablet layout** — Optimized two-column layout for tablet landscape orientation | Frontend | Low–Med | ✅ Done |
| 6.22 | U17 | **Split view: script + waveform** — Show waveform alongside script to visualize text-to-audio mapping | Frontend | High | 🔲 |

**Implementation Notes:**
- Item 6.1 (audio formats) requires a Go-side audio encoder — use `lame` bindings for MP3 or encode client-side via Web Audio + `MediaRecorder`.
- Item 6.2 (batch TTS) needs a job queue pattern in the backend and a `JSZip` library on the frontend for ZIP packaging.
- Item 6.3 (audio editing) is a significant frontend effort — consider `wavesurfer.js` with its regions plugin for trimming.
- Item 6.5 (voice cloning) is blocked on Gemini API support — track the API changelog and implement when available.
- Item 6.19 (PWA) requires careful cache strategy — voice samples and generated audio should be cached, but API responses should be network-first.

---

## Dependency Graph

```
Phase 1 (Quick Wins)
  │
  ├──► Phase 2 (Script Reader & TTS)
  │      │
  │      └──► Phase 4.5 (WebSocket) ◄── Phase 4 (Backend Infra)
  │             │
  │             └──► Phase 2.8 (Streaming TTS)
  │
  ├──► Phase 3 (Preset & Data Management)
  │
  └──► Phase 5 (Navigation Overhaul)
         │
         └──► Phase 6 (Advanced Features & Mobile)

Phase 4 (Backend Infra) ── independent, can run in parallel with Phases 2–3
```

---

## How to Use This Plan

1. **Pick a phase** — Start with Phase 1 for immediate impact, or jump to any phase whose prerequisites are met.
2. **Pick items within a phase** — Items are roughly ordered by complexity (simpler first). Many items within a phase are independent and can be parallelized.
3. **Update status** — As items are completed, update the Status Overview table at the top and mark individual items with ✅.
4. **Cross-reference** — Each item has a `Ref` column linking back to its ID in [IMPROVEMENTS.md](./IMPROVEMENTS.md).

---

*Created: June 2025 — Based on IMPROVEMENTS.md (post–Gemini 3.1 Flash TTS upgrade)*
