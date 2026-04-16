# Gemini 3.1 Flash TTS — Phased Implementation Plan

> Companion document to [GEMINI-3.1-TTS-UPGRADE.md](GEMINI-3.1-TTS-UPGRADE.md)  
> This plan breaks the upgrade into 4 self-contained phases, each independently shippable and testable.

---

## Implementation Status

| Phase | Status | Date |
|---|---|---|
| **1 — Core Model Swap** | ✅ Complete | 2025-06-28 |
| **2 — Language Support** | ✅ Complete | 2025-06-28 |
| **3 — Audio Tags UI** | ✅ Complete | 2025-06-28 |
| **4 — Multi-Speaker** | ✅ Complete | 2025-06-28 |

---

## Overview

| Phase | Scope | Files Changed | Risk | Deliverable |
|---|---|---|---|---|
| **1 — Core Model Swap** | Change TTS model + add retry logic | 1 Go file | Low | Better quality TTS, free tier access, lower latency |
| **2 — Language Support** | Add language code throughout stack | 5-6 files (Go + TS + React) | Low | 70+ language TTS |
| **3 — Audio Tags UI** | Inline tag toolbar for Script Reader | 2-3 files (React) | Very Low | User-facing audio tag insertion |
| **4 — Multi-Speaker** | Two-speaker dialogue support | 7-8 files (Go + TS + React) | Medium | Dialogue generation with distinct voices |

---

## Phase 1: Core Model Swap ✅

**Goal**: Upgrade from `gemini-2.5-pro-preview-tts` to `gemini-3.1-flash-tts-preview` with zero frontend changes. All existing functionality continues to work identically, but with improved audio quality, lower latency, and a free tier.

### Prerequisites

- Backend builds cleanly (`go build ./cmd/server`)
- Existing TTS functionality verified working with current model

### Tasks

#### 1.1 Update model name in `GenerateTTS`

**File**: `backend/internal/gemini/client.go` (line ~203)

```diff
- url := fmt.Sprintf("%s/models/gemini-2.5-pro-preview-tts:generateContent?key=%s", baseURL, c.apiKey)
+ url := fmt.Sprintf("%s/models/gemini-3.1-flash-tts-preview:generateContent?key=%s", baseURL, c.apiKey)
```

#### 1.2 Update package documentation

**File**: `backend/internal/gemini/client.go` (lines 5-9)

```diff
- // It supports two operations: voice recommendation (using gemini-3-flash-preview
- // with structured JSON output) and text-to-speech generation (using
- // gemini-2.5-pro-preview-tts with AUDIO response modality). API key
+ // It supports two operations: voice recommendation (using gemini-3-flash-preview
+ // with structured JSON output) and text-to-speech generation (using
+ // gemini-3.1-flash-tts-preview with AUDIO response modality). API key
```

#### 1.3 Add retry logic for intermittent 500 errors

**File**: `backend/internal/gemini/client.go`

The official Gemini docs state:
> "The model occasionally returns text tokens instead of audio tokens, causing the server to fail the request with a `500` error. Because this occurs randomly in a very small percentage of requests, you should implement automated retry logic."

Wrap the HTTP POST + response handling in `GenerateTTS` in a retry loop:

```go
const maxTTSRetries = 3

func (c *Client) GenerateTTS(text, voiceName, systemInstruction string) (string, error) {
    // ... existing prompt assembly code (unchanged) ...

    data, err := json.Marshal(reqBody)
    if err != nil {
        return "", fmt.Errorf("marshal request: %w", err)
    }

    url := fmt.Sprintf("%s/models/gemini-3.1-flash-tts-preview:generateContent?key=%s", baseURL, c.apiKey)

    var lastErr error
    for attempt := 0; attempt < maxTTSRetries; attempt++ {
        if attempt > 0 {
            time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
            slog.Warn("retrying TTS request", "attempt", attempt+1, "lastError", lastErr)
        }

        resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(data))
        if err != nil {
            lastErr = fmt.Errorf("http request: %w", err)
            continue
        }

        body, err := io.ReadAll(resp.Body)
        resp.Body.Close()
        if err != nil {
            lastErr = fmt.Errorf("read response: %w", err)
            continue
        }

        if resp.StatusCode == http.StatusInternalServerError && attempt < maxTTSRetries-1 {
            lastErr = fmt.Errorf("gemini TTS API error (status 500): %s", string(body))
            continue
        }

        if resp.StatusCode != http.StatusOK {
            return "", fmt.Errorf("gemini TTS API error (status %d): %s", resp.StatusCode, string(body))
        }

        // ... existing response parsing (unchanged) ...
    }
    return "", fmt.Errorf("TTS failed after %d retries: %w", maxTTSRetries, lastErr)
}
```

> **Note**: This requires adding `"log/slog"` to the import list in `client.go`.

### Verification

```bash
cd backend
go build ./cmd/server        # Verify clean build
```

Then test manually:
- [ ] Generate TTS with a stock voice (e.g., Puck) — verify audio plays
- [ ] Generate TTS with a custom preset (system instruction) — verify audio plays
- [ ] Script Reader with stock voice — verify audio plays
- [ ] Script Reader with custom voice — verify audio plays
- [ ] WAV download — verify valid WAV file
- [ ] Check server logs for retry messages (should be rare/absent)

### Rollback

Change the model name back to `gemini-2.5-pro-preview-tts`. Remove retry loop (optional — retry is beneficial regardless of model).

---

## Phase 2: Language Support ✅

**Goal**: Thread an optional `languageCode` parameter through the entire stack so users can explicitly select a language for TTS output. The model auto-detects language by default, so this is additive — existing behavior is unchanged when no language is selected.

### Prerequisites

- Phase 1 complete and verified

### Tasks

#### 2.1 Update Go types

**File**: `backend/internal/gemini/types.go`

Add `LanguageCode` to `TTSRequest`:

```diff
  type TTSRequest struct {
      Text              string `json:"text"`
      VoiceName         string `json:"voiceName"`
      SystemInstruction string `json:"systemInstruction,omitempty"`
+     LanguageCode      string `json:"languageCode,omitempty"`
  }
```

#### 2.2 Update Go client

**File**: `backend/internal/gemini/client.go`

Update `GenerateTTS` signature and `speechConfig`:

```diff
- func (c *Client) GenerateTTS(text, voiceName, systemInstruction string) (string, error) {
+ func (c *Client) GenerateTTS(text, voiceName, systemInstruction, languageCode string) (string, error) {
```

Restructure the `speechConfig` to conditionally include `languageCode`:

```go
speechConfig := map[string]any{
    "voiceConfig": map[string]any{
        "prebuiltVoiceConfig": map[string]any{
            "voiceName": voiceName,
        },
    },
}
if languageCode != "" {
    speechConfig["languageCode"] = languageCode
}
```

#### 2.3 Update Go handler

**File**: `backend/internal/handler/api_voices.go` (line ~101)

```diff
- audioBase64, err := client.GenerateTTS(req.Text, req.VoiceName, req.SystemInstruction)
+ audioBase64, err := client.GenerateTTS(req.Text, req.VoiceName, req.SystemInstruction, req.LanguageCode)
```

#### 2.4 Update frontend API client

**File**: `api.ts`

```diff
- export async function generateTts(text: string, voiceName: string, systemInstruction?: string): Promise<string> {
+ export async function generateTts(text: string, voiceName: string, systemInstruction?: string, languageCode?: string): Promise<string> {
    const body: Record<string, string> = { text, voiceName };
    if (systemInstruction) body.systemInstruction = systemInstruction;
+   if (languageCode) body.languageCode = languageCode;
```

#### 2.5 Add language dropdown to AiTtsPreview

**File**: `components/AiTtsPreview.tsx`

Add a language selector state and dropdown:

```tsx
const [languageCode, setLanguageCode] = useState('');

// In the render, add a dropdown near the voice selector:
<select
  value={languageCode}
  onChange={(e) => setLanguageCode(e.target.value)}
  className="..."
>
  <option value="">Auto-detect</option>
  <option value="en">English</option>
  <option value="es">Spanish</option>
  <option value="fr">French</option>
  <option value="de">German</option>
  <option value="ja">Japanese</option>
  <option value="ko">Korean</option>
  <option value="cmn">Chinese (Mandarin)</option>
  <option value="pt">Portuguese</option>
  <option value="hi">Hindi</option>
  <option value="ar">Arabic</option>
  {/* Add more as needed from the 70+ supported */}
</select>
```

Pass `languageCode` to the `generateTts()` call.

#### 2.6 Pass language code from ScriptReaderModal

**File**: `components/ScriptReaderModal.tsx`

- If using a shared language dropdown, accept it as a prop or add local state
- Thread `languageCode` through to the `AiTtsPreview` component or the direct `generateTts()` call

### Define language constants

Create a shared language list in `constants.ts` or a new `languages.ts` file:

```typescript
export const TTS_LANGUAGES = [
  { code: '', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'cmn', label: 'Chinese (Mandarin)' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ar', label: 'Arabic' },
  { code: 'it', label: 'Italian' },
  { code: 'ru', label: 'Russian' },
  { code: 'nl', label: 'Dutch' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'th', label: 'Thai' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'sv', label: 'Swedish' },
  { code: 'ro', label: 'Romanian' },
  { code: 'id', label: 'Indonesian' },
  { code: 'bn', label: 'Bangla' },
  { code: 'ta', label: 'Tamil' },
  { code: 'te', label: 'Telugu' },
  { code: 'mr', label: 'Marathi' },
  // ... more languages
] as const;
```

### Verification

```bash
cd backend && go build ./cmd/server     # Backend clean build
npx tsc --noEmit                         # Frontend type check
```

Then test:
- [ ] TTS with no language code (auto-detect) — should work as before
- [ ] TTS with explicit `en` — English output
- [ ] TTS with `es` and Spanish text — Spanish output
- [ ] TTS with `ja` and Japanese text — Japanese output
- [ ] TTS with mismatched language code (e.g., `fr` with English text) — behavior is model-dependent, but should not error
- [ ] Language dropdown defaults to "Auto-detect"
- [ ] Custom presets continue to work with/without language code

### Rollback

- Revert `LanguageCode` field from types/handler/client
- Revert `api.ts` parameter
- Remove language dropdown from components

---

## Phase 3: Audio Tags UI ✅

**Goal**: Add user-facing UI for inserting audio tags (e.g., `[whispers]`, `[excited]`, `[laughs]`) into transcript text. These tags already work at the API level — this phase exposes them in the UI.

### Prerequisites

- Phase 1 complete (audio tags work best with 3.1 Flash TTS)

> **Note**: Phase 3 does not depend on Phase 2. It can be implemented in parallel or in any order.

### Tasks

#### 3.1 Define audio tag constants

**File**: `constants.ts` (append) or new `audioTags.ts`

```typescript
export interface AudioTag {
  tag: string;
  label: string;
  category: 'emotion' | 'action' | 'style';
}

export const AUDIO_TAGS: AudioTag[] = [
  // Style
  { tag: '[whispers]', label: 'Whisper', category: 'style' },
  { tag: '[shouting]', label: 'Shout', category: 'style' },
  { tag: '[sarcastic]', label: 'Sarcastic', category: 'style' },
  { tag: '[mischievously]', label: 'Mischievous', category: 'style' },
  { tag: '[serious]', label: 'Serious', category: 'style' },

  // Emotion
  { tag: '[excited]', label: 'Excited', category: 'emotion' },
  { tag: '[happy]', label: 'Happy', category: 'emotion' },
  { tag: '[curious]', label: 'Curious', category: 'emotion' },
  { tag: '[amazed]', label: 'Amazed', category: 'emotion' },
  { tag: '[panicked]', label: 'Panicked', category: 'emotion' },
  { tag: '[tired]', label: 'Tired', category: 'emotion' },
  { tag: '[trembling]', label: 'Trembling', category: 'emotion' },
  { tag: '[crying]', label: 'Crying', category: 'emotion' },
  { tag: '[frustration]', label: 'Frustrated', category: 'emotion' },
  { tag: '[confidence]', label: 'Confident', category: 'emotion' },

  // Actions / Interjections
  { tag: '[sighs]', label: 'Sigh', category: 'action' },
  { tag: '[laughs]', label: 'Laugh', category: 'action' },
  { tag: '[giggles]', label: 'Giggle', category: 'action' },
  { tag: '[gasp]', label: 'Gasp', category: 'action' },
  { tag: '[cough]', label: 'Cough', category: 'action' },
  { tag: '[yawn]', label: 'Yawn', category: 'action' },
  { tag: '[short pause]', label: 'Pause', category: 'action' },
];
```

#### 3.2 Create AudioTagsToolbar component

**File**: `components/AudioTagsToolbar.tsx` (new)

Props:
```typescript
interface AudioTagsToolbarProps {
  onInsertTag: (tag: string) => void;
}
```

Renders a row of small pill buttons grouped by category. Clicking inserts the tag at the cursor position in the parent's textarea via the `onInsertTag` callback.

Design considerations:
- Use Tailwind pill buttons: `rounded-full px-2 py-0.5 text-xs`
- Group by category with subtle labels: "Style", "Emotion", "Sound"
- Color-code categories: blue for style, amber for emotion, green for actions
- Support dark mode with `dark:` variants
- Collapsible/expandable to avoid overwhelming the textarea area
- Include a small "?" icon that shows a tooltip explaining audio tags

#### 3.3 Integrate into ScriptReaderModal

**File**: `components/ScriptReaderModal.tsx`

1. Import `AudioTagsToolbar`
2. Change the custom text input from `<input>` to `<textarea>` if not already
3. Use a `useRef` on the textarea to get cursor position
4. On `onInsertTag`, insert the tag string at the cursor position and update state
5. Place the toolbar between the text input label and the textarea

```tsx
const textareaRef = useRef<HTMLTextAreaElement>(null);

const handleInsertTag = (tag: string) => {
  const textarea = textareaRef.current;
  if (!textarea) return;
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = customText;
  const newText = text.substring(0, start) + tag + ' ' + text.substring(end);
  setCustomText(newText);
  // Restore cursor after tag
  requestAnimationFrame(() => {
    textarea.selectionStart = textarea.selectionEnd = start + tag.length + 1;
    textarea.focus();
  });
};
```

#### 3.4 Optionally integrate into AiTtsPreview

**File**: `components/AiTtsPreview.tsx`

If `AiTtsPreview` has its own text input (for quick TTS generation), add the toolbar there too. Otherwise, skip — the main Script Reader is the primary input surface.

### Verification

- [ ] Audio tags toolbar renders below/above the text input in Script Reader
- [ ] Clicking a tag pill inserts `[tag] ` at cursor position
- [ ] Tags display with correct category colors
- [ ] Tags are visible in both light and dark mode
- [ ] Generated TTS with `[whispers]` produces audibly whispered speech
- [ ] Generated TTS with `[excited]` produces audibly excited speech
- [ ] Multiple tags in one transcript work correctly
- [ ] Tags work with both stock and custom voice presets

### Rollback

Remove `AudioTagsToolbar` component and integration from `ScriptReaderModal`. Remove constants.

---

## Phase 4: Multi-Speaker Support ✅

**Goal**: Enable two-speaker dialogue generation where each speaker has a distinct voice. This is a larger feature requiring backend + frontend changes.

### Prerequisites

- Phase 1 complete
- Phase 2 recommended (language code support)

### Tasks

#### 4.1 Add Go types

**File**: `backend/internal/gemini/types.go`

```go
// MultiSpeakerTTSRequest is the payload for multi-speaker dialogue.
type MultiSpeakerTTSRequest struct {
    Text         string          `json:"text"`
    Speakers     []SpeakerConfig `json:"speakers"`
    LanguageCode string          `json:"languageCode,omitempty"`
}

// SpeakerConfig maps a speaker label to a voice name.
type SpeakerConfig struct {
    Speaker   string `json:"speaker"`
    VoiceName string `json:"voiceName"`
}
```

#### 4.2 Add Go client method

**File**: `backend/internal/gemini/client.go`

Add `GenerateMultiSpeakerTTS(text string, speakers []SpeakerConfig, languageCode string) (string, error)` that builds a `multiSpeakerVoiceConfig` instead of `voiceConfig`.

The method should:
1. Build `speakerVoiceConfigs` array from `speakers` slice
2. Use `multiSpeakerVoiceConfig` in `speechConfig`
3. Include `languageCode` if provided
4. Use the same retry logic as `GenerateTTS`
5. Parse the response envelope the same way (audio is in `inlineData`)

#### 4.3 Add Go handler

**File**: `backend/internal/handler/api_voices.go`

Add `GenerateMultiSpeakerTTS(w http.ResponseWriter, r *http.Request)` handler:
- Decode `MultiSpeakerTTSRequest`
- Validate: text required, 1-2 speakers, each with speaker name and voice name
- Call `client.GenerateMultiSpeakerTTS()`
- Cache audio and save to history
- Return `TTSResponse`

#### 4.4 Register route

**File**: `backend/internal/server/routes.go`

```go
mux.HandleFunc("POST /api/voices/tts/multi", voicesH.GenerateMultiSpeakerTTS)
```

#### 4.5 Add frontend API function

**File**: `api.ts`

```typescript
export async function generateMultiSpeakerTts(
  text: string,
  speakers: { speaker: string; voiceName: string }[],
  languageCode?: string
): Promise<string> {
  const body: Record<string, any> = { text, speakers };
  if (languageCode) body.languageCode = languageCode;
  const data = await request<{ audioBase64: string }>('/voices/tts/multi', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.audioBase64;
}
```

#### 4.6 Add frontend types

**File**: `types.ts`

```typescript
export interface SpeakerConfig {
  speaker: string;
  voiceName: string;
}
```

#### 4.7 Update ScriptReaderModal for dialogue mode

**File**: `components/ScriptReaderModal.tsx`

Add:
- A "Dialogue Mode" toggle (single vs multi-speaker)
- When in dialogue mode:
  - Show 2 voice selectors (Speaker 1 / Speaker 2)
  - Show speaker name inputs (default: "Speaker1", "Speaker2")
  - Format the transcript with speaker labels
  - Use `generateMultiSpeakerTts()` instead of `generateTts()`
- Keep single-speaker as the default mode

#### 4.8 Update AiTtsPreview for multi-speaker playback

**File**: `components/AiTtsPreview.tsx`

- The audio response format is the same (PCM base64), so existing playback logic works
- May want to show speaker labels in the UI when in dialogue mode
- WAV download works the same way

### UI Design Notes

```
┌─────────────────────────────────────┐
│  Script Reader                   ✕  │
│                                     │
│  Mode: ○ Single Speaker             │
│        ● Dialogue (2 Speakers)      │
│                                     │
│  Speaker 1: [Name input] [Voice ▾]  │
│  Speaker 2: [Name input] [Voice ▾]  │
│                                     │
│  ┌────────────────────────────────┐  │
│  │ Speaker1: Hello there!        │  │
│  │ Speaker2: Hi! How are you?    │  │
│  │ Speaker1: I'm doing great!    │  │
│  └────────────────────────────────┘  │
│                                     │
│  [Audio Tags: whisper | shout | ...]│
│                                     │
│  [▶ Generate] [⬇ Download WAV]     │
└─────────────────────────────────────┘
```

### Verification

```bash
cd backend && go build ./cmd/server
npx tsc --noEmit
```

Then test:
- [ ] Dialogue mode toggle shows/hides two-speaker UI
- [ ] Both speakers can select different voices
- [ ] Speaker names are customizable
- [ ] Generated audio has two distinct voices
- [ ] Audio plays correctly
- [ ] WAV download works
- [ ] History saves multi-speaker entries
- [ ] Switching back to single-speaker mode works
- [ ] Audio tags work in multi-speaker transcripts
- [ ] Language selector works with multi-speaker

### Rollback

- Remove route from `routes.go`
- Remove handler method
- Remove client method and types
- Revert `ScriptReaderModal` dialogue mode UI
- Remove `generateMultiSpeakerTts` from `api.ts`
- Remove `SpeakerConfig` from `types.ts`

---

## Implementation Order & Dependencies

```
Phase 1 (Core Model Swap)
    │
    ├──> Phase 2 (Language Support)
    │        │
    │        └──> Phase 4 (Multi-Speaker)
    │
    └──> Phase 3 (Audio Tags UI)
```

- **Phase 1** is required first — all subsequent phases depend on the 3.1 model
- **Phase 2** and **Phase 3** are independent of each other — can be done in parallel or in any order
- **Phase 4** benefits from Phase 2 (language code) but can be adapted without it
- Each phase is independently shippable — the app is fully functional after any phase

---

## Risk Assessment

| Phase | Risk Level | Key Risks | Mitigations |
|---|---|---|---|
| 1 — Core Swap | **Low** | Model behavior differences; intermittent 500s | Retry logic; one-line rollback |
| 2 — Languages | **Low** | Incorrect language detection; UI clutter | Default to auto-detect; collapsible dropdown |
| 3 — Audio Tags | **Very Low** | Tags not producing expected effect | Tags are just text — no API change needed |
| 4 — Multi-Speaker | **Medium** | Complex UI state; speaker name mismatches; increased prompt size | Thorough validation; clear error messages; prompt format helper |

---

## Summary

| Phase | Scope | Key Benefit | Backend Files | Frontend Files |
|---|---|---|---|---|
| **1** | Model swap + retry | Better quality, free tier, lower latency | 1 | 0 |
| **2** | Language code | 70+ language support | 3 | 2-3 |
| **3** | Audio tags toolbar | Expressive speech control | 0 | 2-3 |
| **4** | Multi-speaker | Dialogue generation | 3-4 | 3-4 |
| **Total** | | | 7-8 | 7-10 |

Start with **Phase 1** — it's a 1-file, low-risk change that immediately delivers better TTS quality and a free development tier.
