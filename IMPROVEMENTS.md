# Gemini Voice Library — Future Improvements

A curated list of potential enhancements organized by category. Items are roughly prioritized within each section (high-impact first).

---

## Functionality Improvements

### Audio & Playback

| # | Feature | Description |
|---|---------|-------------|
| F1 | **Streaming TTS playback** | Stream audio chunks as they arrive from the Gemini API instead of waiting for the full response. Reduces perceived latency on long scripts. |
| F2 | **Multi-speaker TTS** | Leverage Gemini's `MultiSpeakerVoiceConfig` to cast different voices for different characters in a single script. Add a speaker assignment UI in the Script Reader. |
| F3 | **Audio format options** | Support MP3 and OGG export alongside WAV. Add bitrate/sample-rate controls in Settings. |
| F4 | **Batch TTS generation** | Queue multiple text segments and voices for bulk generation. Download all results as a ZIP archive. |
| F5 | **Audio trimming & editing** | Basic waveform editor for trimming silence, adjusting start/end points, and normalizing volume before export. |
| F6 | **Playback speed control** | Add 0.5×, 0.75×, 1×, 1.25×, 1.5×, 2× speed options for TTS playback. |
| F7 | **Audio bookmarking** | Mark and name specific timestamps in longer generated audio for quick scrubbing. |

### AI & Voice Intelligence

| # | Feature | Description |
|---|---------|-------------|
| F8 | **Voice comparison mode** | Generate the same text with 2–3 voices side-by-side for quick A/B comparison. |
| F9 | **Prompt template library** | Ship built-in prompt templates (Podcast Host, Audiobook Narrator, Commercial VO, etc.) that users can apply to any voice. |
| F10 | **Voice cloning / fine-tuning** | When Gemini supports it, allow users to upload a reference audio clip and create a custom voice clone. |
| F11 | **Emotion / style tags** | Expose the `[whispers]`, `[excited]`, `[sarcastic]` audio tags from the Gemini TTS prompting guide as clickable buttons that insert into the script. |
| F12 | **Smart script formatter** | Use Gemini to auto-format plain text into the optimal TTS prompt structure (Audio Profile → Scene → Director's Notes → Transcript). |
| F13 | **Voice similarity search** | "Find voices similar to X" — use embeddings or characteristic vectors to recommend voices with similar tonal qualities. |
| F14 | **Language detection & routing** | Auto-detect script language and suggest the best voice + `languageCode` for that language from the 70+ supported languages. |

### Preset & Project Management

| # | Feature | Description |
|---|---------|-------------|
| F15 | **Preset folders / tags** | Organize custom presets into folders or add colored tags (e.g., "Podcast", "Commercial", "Character"). |
| F16 | **Preset import / export** | Export presets as JSON files and import them on another machine or share with teammates. |
| F17 | **Preset duplication** | One-click duplicate a preset to create a variant with a different style or voice. |
| F18 | **Project workspaces** | Group related presets, scripts, and generated audio into named projects with separate histories. |
| F19 | **Favorite voices** | Star/heart individual stock voices for quick access without creating a full preset. |
| F20 | **Preset versioning** | Track edit history for presets so users can revert to a previous system instruction. |

### History & Data

| # | Feature | Description |
|---|---------|-------------|
| F21 | **History search & filtering** | Full-text search across history entries. Filter by date range, voice, or generation type. |
| F22 | **History export** | Export generation history as CSV or JSON for record-keeping. |
| F23 | **Audio cache management** | Show total cache size in Settings. Add "Clear cache" and per-entry delete options. |
| F24 | **Usage analytics dashboard** | Simple charts showing voices used most, generation count over time, and total audio generated. |
| F25 | **Undo/redo for TTS settings** | Undo last generation parameters (voice, text, style) to quickly iterate. |

### Backend & Infrastructure

| # | Feature | Description |
|---|---------|-------------|
| F26 | **Retry logic for TTS 500 errors** | Gemini TTS occasionally returns text tokens instead of audio (per docs). Add automatic retry with exponential backoff. |
| F27 | **Rate limiting** | Add configurable rate limiting on TTS and recommendation endpoints to stay within Gemini API quotas. |
| F28 | **API key rotation** | Support multiple API keys with automatic rotation when one hits rate limits. |
| F29 | **Backup & restore** | One-click SQLite database backup/restore from Settings. |
| F30 | **Docker support** | Add `Dockerfile` and `docker-compose.yml` for containerized deployment. |
| F31 | **WebSocket progress** | Push real-time generation progress (percentage, stage) to the frontend via WebSocket instead of polling. |
| F32 | **Model selection** | Let users choose between `gemini-2.5-pro-preview-tts` and `gemini-3.1-flash-tts-preview` per generation (speed vs. quality trade-off). |
| F33 | **OpenAI TTS fallback** | Add optional OpenAI TTS support as a secondary provider for redundancy. |

---

## UI / UX Improvements

### Layout & Navigation

| # | Feature | Description |
|---|---------|-------------|
| U1 | **Sidebar navigation** | Replace the top nav with a collapsible sidebar for quicker access to Voices, Presets, History, and Settings on desktop. |
| U2 | **Breadcrumb / tab bar** | Add a persistent tab bar (Stock Voices → My Voices → Script Reader → History) for faster navigation without modals. |
| U3 | **Split-pane Script Reader** | Show the voice browser on the left and the script editor on the right so users can switch voices without closing the editor. |
| U4 | **Floating mini-player** | Persistent bottom audio player that stays visible while navigating, showing current voice, waveform, and play/pause. |
| U5 | **Keyboard shortcut overlay** | Press `?` to show a keyboard shortcut cheat sheet (Space = play, arrows = navigate, etc.). |
| U6 | **Command palette** | `Ctrl+K` command palette for quick actions: switch voice, open settings, generate TTS, search presets. |

### Voice Cards & Carousel

| # | Feature | Description |
|---|---------|-------------|
| U7 | **Voice card hover preview** | Auto-play a 2-second voice sample on hover (with option to disable in Settings). |
| U8 | **Card detail expansion** | Click a voice card to expand an inline detail panel with full characteristics, analysis, sample player, and quick TTS — without opening a modal. |
| U9 | **Carousel pagination dots** | Add dot indicators below the 3D carousel showing position within the filtered set. |
| U10 | **Grid density toggle** | Compact / comfortable / spacious grid density options (more cards vs. larger cards). |
| U11 | **Voice card badges** | Show small badges on cards: "New", "Popular", "AI Recommended", language flags. |
| U12 | **Animated card transitions** | Smoother entry/exit animations when filtering changes the visible card set. |

### Script Reader & TTS

| # | Feature | Description |
|---|---------|-------------|
| U13 | **Live character count** | Show character count and estimated audio duration below the script input. |
| U14 | **Script templates** | Pre-loaded example scripts (news anchor, bedtime story, product ad, podcast intro) for quick testing. |
| U15 | **Syntax highlighting for tags** | Color-code `[whispers]`, `[excited]`, `[pause]` audio tags in the script editor. |
| U16 | **Drag-and-drop script files** | Drop `.txt` or `.md` files onto the Script Reader to import text. |
| U17 | **Split view: script + waveform** | Show the generated waveform alongside the script so users can see which part of the text maps to which audio segment. |
| U18 | **Recent scripts** | Remember the last 5 scripts used and offer a dropdown to re-select them. |

### Presets UI

| # | Feature | Description |
|---|---------|-------------|
| U19 | **Preset card audio waveform** | Show a mini waveform on each preset card instead of a generic icon, using the cached sample audio. |
| U20 | **Drag-to-reorder presets** | Allow manual sorting of presets via drag-and-drop in grid view. |
| U21 | **Preset color coding** | Assign a color accent to each preset for quick visual identification in the carousel. |
| U22 | **Inline preset editing** | Edit preset name and system instruction directly on the card without opening a modal. |
| U23 | **Preset preview tooltip** | Hover over a preset to see a truncated preview of its system instruction. |

### Visual Polish

| # | Feature | Description |
|---|---------|-------------|
| U24 | **Loading skeleton screens** | Replace spinners with skeleton placeholder animations during TTS generation and data fetching. |
| U25 | **Toast notifications** | Replace or supplement inline status messages with dismissible toast notifications for success/error states. |
| U26 | **Micro-interactions** | Add subtle animations: button press ripple, card flip on save, confetti on first TTS generation. |
| U27 | **Custom theme colors** | Let users pick an accent color beyond dark/light mode (blue, purple, green, rose, etc.). |
| U28 | **High-contrast mode** | Add an accessibility-focused high-contrast theme option. |
| U29 | **Glass morphism refinement** | Improve the frosted glass effects with more consistent blur values and better dark-mode contrast ratios. |
| U30 | **Onboarding tour** | First-time walkthrough highlighting key features: voice browsing, AI Casting Director, Script Reader, and Settings. |

### Responsive & Mobile

| # | Feature | Description |
|---|---------|-------------|
| U31 | **Bottom sheet modals on mobile** | Convert modals to swipeable bottom sheets on small screens for a native-feel mobile experience. |
| U32 | **Touch gesture improvements** | Swipe between carousel cards with momentum, pinch-to-zoom on waveforms. |
| U33 | **PWA support** | Add a `manifest.json` and service worker for installable Progressive Web App support with offline cached voices. |
| U34 | **Responsive filter drawer** | Move all filters into a slide-out drawer on mobile instead of the multi-row filter bar. |
| U35 | **Landscape tablet layout** | Optimize the two-column layout for iPad / tablet landscape orientation. |

---

## Quick Wins (Low Effort, High Impact)

| # | Item | Category |
|---|------|----------|
| Q1 | Add retry logic for Gemini TTS 500 errors | Backend |
| Q2 | Show character count in Script Reader | UI |
| Q3 | Add favorite/star toggle on voice cards | UI + Backend |
| Q4 | Preset duplication button | UI + Backend |
| Q5 | Toast notifications for save/delete/error | UI |
| Q6 | Keyboard shortcut `?` overlay | UI |
| Q7 | Loading skeleton screens | UI |
| Q8 | Audio tag insertion buttons in Script Reader | UI |
| Q9 | Docker support | Backend |
| Q10 | Model selection toggle (Flash vs Pro TTS) | Backend + UI |

---

*Last updated: 2025*
