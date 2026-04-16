<p align="center">
  <img src="assets/banner.svg" alt="Gemini Voice Library — Powered by Gemini 3.1 Flash TTS — 70+ Languages — Multi-Speaker Dialogue" width="100%">
</p>

# Gemini Voice Library

An interactive web application for discovering, previewing, and casting AI voices using Google's Gemini Text-to-Speech API. Browse 30 curated voices, get AI-powered voice recommendations, generate speech from custom scripts in 70+ languages, create multi-speaker dialogues, and download audio — all in a polished, accessible interface.

Ships as a **single cross-platform binary** (Windows, macOS, Linux) with a pure Go backend, embedded frontend, SQLite persistence, and encrypted API key storage.

> **Powered by [Gemini 3.1 Flash TTS](https://ai.google.dev/gemini-api/docs/speech-generation)** — Google's latest dedicated speech synthesis model with improved quality, lower latency, and a free tier.

## Features

- **Voice Browsing** — Explore 30 pre-loaded voices with detailed metadata (gender, pitch, characteristics) in a 3D carousel or responsive grid view
- **Custom Voice Presets ("My Voices")** — Save AI-recommended voices as custom presets with cached sample audio, then switch between Stock and My Voices tabs to browse them in the same carousel / grid UI
- **AI Casting Director** — Describe your ideal voice in natural language and let Gemini analyze the library to recommend the top 3 matches, complete with a structured system prompt (Audio Profile, Scene, Director's Notes, Sample Context, Transcript)
- **Script Reader** — Enter custom text and preview it with any stock or custom voice using real-time TTS generation, with a Stock / My Voices toggle
- **Multi-Language TTS** — Generate speech in 70+ languages with an explicit language selector (Arabic, Chinese, French, German, Hindi, Japanese, Korean, Spanish, and many more), or let the model auto-detect
- **Audio Tags** — Insert inline delivery annotations like `[whispers]`, `[excited]`, `[laughs]`, `[sighs]` via a collapsible toolbar grouped by Style, Emotion, and Sound categories
- **Multi-Speaker Dialogue** — Switch to Dialogue mode in the Script Reader to assign two distinct voices to speaker labels and generate natural two-voice conversations
- **Audio Playback & Download** — Listen to voice samples, generate speech via Gemini 3.1 Flash TTS, and export as WAV files
- **Smart Filtering** — Filter voices by gender, pitch, or free-text search across names and characteristics
- **Settings & API Key Management** — Store your Gemini API key securely with AES-256-GCM encryption
- **Generation History** — Browse, filter, and manage past TTS and recommendation history
- **Dark / Light Mode** — Full theme support with smooth transitions
- **Keyboard & Accessibility** — Focus traps in modals, arrow-key carousel navigation, Enter/Space playback, ARIA labels, and semantic HTML

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 with TypeScript 5.8 |
| Build Tool | Vite 6 |
| Styling | Tailwind CSS (CDN) with custom theme config |
| Animations | Framer Motion 11 |
| Icons | Lucide React |
| Markdown | react-markdown 9 |
| Audio | Web Audio API, HTML5 Canvas visualizer |
| Backend | Go 1.22+ (pure Go, no CGo) |
| Database | SQLite via `modernc.org/sqlite` |
| Encryption | AES-256-GCM (stdlib `crypto/aes`) |
| HTTP Server | `net/http` stdlib with Go 1.22 pattern matching |

### Gemini Models Used

| Model | Purpose |
|-------|---------|
| `gemini-3-flash-preview` | AI voice recommendations (structured JSON output) |
| `gemini-3.1-flash-tts-preview` | Text-to-Speech audio generation (single & multi-speaker) |

## Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Go](https://go.dev/) 1.22+
- A [Google AI Studio](https://aistudio.google.com/) API key with access to Gemini models

## Getting Started

### Quick Start (Development)

1. **Clone the repository**

   ```bash
   git clone https://github.com/ajbergh/Gemini-Voice-Gen-TTS.git
   cd Gemini-Voice-Gen-TTS
   ```

2. **Install frontend dependencies**

   ```bash
   npm install
   ```

3. **Start the frontend dev server**

   ```bash
   npm run dev
   ```

4. **Start the Go backend** (in a second terminal)

   ```bash
   cd backend
   go run ./cmd/server
   ```

   The frontend runs at [http://localhost:3000](http://localhost:3000) and proxies API calls to the backend on port 8080.

5. **Configure your API key** — Open the app and click the Settings icon to save your Gemini API key. It is encrypted and stored locally in SQLite.

### Production Build (Single Binary)

Build a self-contained binary with the frontend embedded. Use the platform-specific build scripts in `scripts/`:

**Windows (PowerShell):**
```powershell
.\scripts\build-windows.ps1            # Default: amd64
.\scripts\build-windows.ps1 -Arch arm64
.\scripts\build-windows.ps1 -Clean     # Clean build artifacts first
```

**Linux (Bash):**
```bash
chmod +x scripts/build-linux.sh
./scripts/build-linux.sh                # Default: amd64
./scripts/build-linux.sh --arch arm64
./scripts/build-linux.sh --clean
```

**macOS (Bash):**
```bash
chmod +x scripts/build-macos.sh
./scripts/build-macos.sh                # Default: arm64 (Apple Silicon)
./scripts/build-macos.sh --arch amd64   # Intel Mac
./scripts/build-macos.sh --universal    # Universal binary (amd64 + arm64 via lipo)
./scripts/build-macos.sh --clean
```

All scripts output to `bin/`. Run the binary:

```bash
./bin/gemini-voice-library-<os>-<arch> --port 8080 --open
```

### CLI Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--port` | `8080` | HTTP server port |
| `--db` | `<platform data dir>/gemini-voice-gen-tts/data.db` | SQLite database path |
| `--passphrase` | *(machine-derived)* | Passphrase for API key encryption |
| `--log-level` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `--open` | `false` | Auto-open browser on startup |

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server on port 3000 |
| `npm run build` | Build frontend for production |
| `npm run preview` | Preview the production build locally |
| `go run ./cmd/server` | Run the Go backend (from `backend/`) |
| `go build ./cmd/server` | Build the Go backend binary |
| `scripts/build-windows.ps1` | Full build for Windows (PowerShell) |
| `scripts/build-linux.sh` | Full build for Linux (Bash) |
| `scripts/build-macos.sh` | Full build for macOS (Bash, supports --universal) |

## Project Structure

```
├── index.html              # HTML entry with Tailwind config, fonts & importmap
├── index.tsx               # React root mount
├── index.css               # Global CSS overrides
├── App.tsx                 # Main application component (state, routing, modals)
├── api.ts                  # Frontend API client (all backend endpoints)
├── constants.ts            # Voice library data (30 voices with metadata)
├── types.ts                # TypeScript interfaces (Voice, FilterState, AiRecommendation, CustomPreset)
├── vite.config.ts          # Vite config (React plugin, API proxy, path aliases)
├── scripts/
│   ├── build-windows.ps1   # Windows build script (PowerShell)
│   ├── build-linux.sh      # Linux build script (Bash)
│   └── build-macos.sh      # macOS build script (Bash, universal binary support)
├── components/
│   ├── FilterBar.tsx        # Top nav bar (search, filters, view toggle, theme, settings)
│   ├── Carousel3D.tsx       # 3D perspective carousel with drag & keyboard nav
│   ├── GridView.tsx         # Responsive grid layout for voices
│   ├── VoiceCard.tsx        # Individual voice card (grid view)
│   ├── VoiceFinder.tsx      # AI Casting Director modal (Gemini recommendations)
│   ├── AiResultCard.tsx     # AI recommendation result display
│   ├── AiTtsPreview.tsx     # TTS generation, playback & download controls
│   ├── AudioVisualizer.tsx  # Canvas-based waveform with Google color cycling
│   ├── AudioTagsToolbar.tsx # Collapsible audio tag insertion toolbar (whispers, excited, etc.)
│   ├── ScriptReaderModal.tsx # Custom script input with TTS preview (stock + custom + dialogue)
│   ├── SettingsModal.tsx    # API key management (save, test, delete)
│   ├── HistoryPanel.tsx     # Generation history browser
│   ├── ControlBar.tsx       # Additional controls component
│   ├── PresetCard.tsx       # Individual custom voice preset card (grid view)
│   ├── PresetCarousel3D.tsx # 3D perspective carousel for custom presets
│   ├── PresetGrid.tsx       # Responsive grid layout for custom presets
│   └── PresetEditModal.tsx  # Edit custom voice preset modal
└── backend/
    ├── cmd/server/main.go          # Entry point with CLI flags & graceful shutdown
    ├── Makefile                    # Cross-platform build targets
    ├── go.mod / go.sum             # Go module definition
    └── internal/
        ├── config/config.go        # App configuration (JSON, platform-aware defaults)
        ├── crypto/crypto.go        # AES-256-GCM encryption for API keys
        ├── embed/frontend.go       # go:embed for bundled frontend
        ├── gemini/                  # Gemini API client (recommend + TTS)
        ├── handler/                 # HTTP handlers (health, keys, config, history, voices, presets)
        ├── server/                  # HTTP server, routes, middleware
        └── store/                   # SQLite store with embedded migrations
```

## Architecture

```
Browser (React SPA)
├── FilterBar ─── Search, Filters, View Mode, Theme, Settings, History
├── Carousel3D ── 3D card stack with Framer Motion
│   └── AudioVisualizer
├── GridView ──── Responsive card grid
│   └── VoiceCard → AudioVisualizer
├── PresetCarousel3D ── 3D carousel for custom voice presets
├── PresetGrid ──────── Grid layout for custom presets
│   └── PresetCard
├── VoiceFinder ─ AI Casting (via /api/voices/recommend)
├── AiResultCard  AI result display
│   └── AiTtsPreview (via /api/voices/tts)
├── SettingsModal  API key management (via /api/keys)
├── HistoryPanel   History browser (via /api/history)
├── PresetEditModal  Edit preset name & system instruction
└── ScriptReaderModal ── Custom script testing (stock + custom voices + dialogue mode)
    └── AiTtsPreview / Multi-Speaker TTS

Go Backend (net/http)
├── /api/health              GET    Health check
├── /api/config              GET    Read config
├── /api/config              PUT    Update config
├── /api/keys                GET    List API key providers
├── /api/keys                POST   Store encrypted API key
├── /api/keys/{provider}     DELETE Remove API key
├── /api/keys/{provider}/test GET   Validate API key against Gemini
├── /api/history             GET    List history (paginated, filterable)
├── /api/history/{id}        GET    Single history entry
├── /api/history/{id}/audio  GET    Cached audio as base64 (TTS entries)
├── /api/history/{id}        DELETE Delete history entry
├── /api/history             DELETE Clear all history
├── /api/voices              GET    List voices from DB
├── /api/voices/recommend    POST   AI voice recommendations (Gemini 3 Flash)
├── /api/voices/tts          POST   TTS generation (Gemini 3.1 Flash TTS)
├── /api/voices/tts/multi    POST   Multi-speaker dialogue TTS generation
├── /api/presets             GET    List custom voice presets
├── /api/presets             POST   Create a new preset
├── /api/presets/{id}        PUT    Update preset (name, system instruction)
├── /api/presets/{id}        DELETE Delete a preset
└── /api/presets/{id}/audio  GET    Cached audio for a preset
```

**Data flow:** Frontend → `/api/*` → Go handlers → Gemini API. API keys are encrypted at rest with AES-256-GCM. All state persists in a local SQLite database. In production, the frontend is embedded in the Go binary via `go:embed`.

## License

Apache-2.0
