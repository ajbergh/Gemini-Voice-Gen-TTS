# Gemini 3.1 Flash TTS — Upgrade Plan

> **Model**: `gemini-3.1-flash-tts-preview`  
> **Released**: April 15, 2026  
> **Status**: Preview (rolling out via Gemini API, Google AI Studio, Vertex AI)  
> **Docs**: [Model Card](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-tts-preview) · [Speech Generation Guide](https://ai.google.dev/gemini-api/docs/speech-generation) · [Blog Post](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts/)

---

## Table of Contents

1. [What's New in 3.1 Flash TTS](#1-whats-new-in-31-flash-tts)
2. [Model Comparison](#2-model-comparison)
3. [New Capabilities to Implement](#3-new-capabilities-to-implement)
4. [Backend Changes (Go)](#4-backend-changes-go)
5. [Frontend Changes (React/TypeScript)](#5-frontend-changes-reacttypescript)
6. [API Contract Changes](#6-api-contract-changes)
7. [Audio Tags Reference](#7-audio-tags-reference)
8. [Multi-Speaker Support](#8-multi-speaker-support)
9. [Language Support Expansion](#9-language-support-expansion)
10. [Pricing Impact](#10-pricing-impact)
11. [Known Limitations & Mitigations](#11-known-limitations--mitigations)
12. [Migration Steps](#12-migration-steps)
13. [Testing Checklist](#13-testing-checklist)
14. [Rollback Plan](#14-rollback-plan)

---

## 1. What's New in 3.1 Flash TTS

Gemini 3.1 Flash TTS is Google's most natural and expressive TTS model, achieving an Elo score of **1,211** on the Artificial Analysis TTS leaderboard. It is positioned in the "most attractive quadrant" for quality-to-cost ratio.

### Key Improvements Over 2.5 Pro Preview TTS

| Feature | 2.5 Pro Preview TTS | 3.1 Flash TTS Preview |
|---|---|---|
| **Speech quality** | Good | Significantly improved naturalness & expressivity |
| **Audio tags** | Basic support | Full expressive audio tags (emotions, interjections, whispers, etc.) |
| **Controllability** | Natural language prompts | Enhanced granular control via audio tags + natural language |
| **Languages** | ~24 languages | **70+ languages** |
| **Multi-speaker** | Up to 2 speakers | Up to 2 speakers (improved quality) |
| **Token limits** | 32k context window | **8,192 input / 16,384 output tokens** |
| **Batch API** | Not specified | ✅ Supported |
| **SynthID watermark** | Not specified | ✅ All output watermarked |
| **Latency** | Higher (Pro model) | **Lower latency** (Flash-class model) |
| **API endpoint** | `gemini-2.5-pro-preview-tts` | `gemini-3.1-flash-tts-preview` |

### Headline Features

- **Expressive Audio Tags**: Embed `[whispers]`, `[shouting]`, `[excited]`, `[sighs]`, `[laughs]`, and many more inline in transcripts to control delivery at the word/sentence level.
- **Scene Direction**: Define environments and contextual "vibe" for characters to stay in-character.
- **Speaker-Level Specificity**: Cast characters with unique Audio Profiles, then toggle pace/tone/accent via Director's Notes and inline tags.
- **70+ Language Support**: Major expansion from ~24 to 70+ languages with advanced style, pacing, and accent control across all of them.
- **SynthID Watermarking**: All generated audio is watermarked for AI content detection.

---

## 2. Model Comparison

### API Capabilities Matrix

| Capability | 2.5 Pro TTS | 3.1 Flash TTS |
|---|---|---|
| Audio generation | ✅ | ✅ |
| Batch API | ❌ | ✅ |
| Context caching | ❌ | ❌ |
| Code execution | ❌ | ❌ |
| Function calling | ❌ | ❌ |
| Structured outputs | ❌ | ❌ |
| Thinking | ❌ | ❌ |
| Live API | ❌ | ❌ |
| Streaming | ❌ | ❌ |

### Input/Output

| Property | 2.5 Pro TTS | 3.1 Flash TTS |
|---|---|---|
| Inputs | Text only | Text only |
| Outputs | Audio only | Audio only |
| Input token limit | 32k (context window) | 8,192 |
| Output token limit | — | 16,384 |
| Audio format | PCM 24kHz 16-bit mono | PCM 24kHz 16-bit mono |

> **Note**: The input token limit is reduced from 32k to 8,192. This should be verified in practice — most TTS prompts (Audio Profile + Scene + Director's Notes + Transcript) are well under 8k tokens, but very long scripts may need to be chunked.

---

## 3. New Capabilities to Implement

### 3.1 Audio Tags in Transcript (High Priority)

Audio tags are inline markers in square brackets that modify speech delivery. The app should expose these to users in the Script Reader and custom preset workflows.

**Implementation ideas:**
- Add an "Audio Tags" quick-insert toolbar in `ScriptReaderModal.tsx` with common tags
- Show a tooltip/help panel listing available tags
- Allow users to type tags directly in the text input (they already flow through to the API)

### 3.2 Language Selector (High Priority)

The model supports 70+ languages with automatic detection. Adding an optional language selector ensures the correct language is spoken when text could be ambiguous.

**Implementation ideas:**
- Add an optional `languageCode` field to the TTS request
- Add a language dropdown in `ScriptReaderModal.tsx` and `AiTtsPreview.tsx`
- Pass `languageCode` through `SpeechConfig` in the API request

### 3.3 Multi-Speaker Dialogue (Medium Priority)

Native multi-speaker support with up to 2 speakers, each with their own voice.

**Implementation ideas:**
- New "Dialogue Mode" toggle in Script Reader
- Allow assigning two voices (one per speaker)
- Format prompt with speaker labels (`Speaker1:`, `Speaker2:`)
- Use `MultiSpeakerVoiceConfig` in the API request instead of `VoiceConfig`

### 3.4 Batch API Support (Low Priority / Future)

Batch API is supported, enabling 50% cost reduction for non-real-time workloads.

**Implementation ideas:**
- Add a "Batch Generate" option for generating multiple preset samples at once
- Queue requests and poll for completion

### 3.5 Enhanced Prompting Structure (Medium Priority)

The official prompting guide now has a well-defined structure. The AI Casting Director's output already follows this, but we can improve it:

**Recommended prompt structure:**
```markdown
# AUDIO PROFILE: {Character Name}
## "{Role/Archetype}"

## THE SCENE: {Location}
{Environmental description, mood, vibe}

### DIRECTOR'S NOTES
Style: {Tone, emotion, delivery style}
Pacing: {Speed, rhythm, cadence}
Accent: {Specific regional accent}

### SAMPLE CONTEXT
{Contextual starting point for the character}

#### TRANSCRIPT
{The actual text with [audio tags] inline}
```

---

## 4. Backend Changes (Go)

### 4.1 Update Model Name in `client.go`

**File**: `backend/internal/gemini/client.go`

**Current** (line ~203):
```go
url := fmt.Sprintf("%s/models/gemini-2.5-pro-preview-tts:generateContent?key=%s", baseURL, c.apiKey)
```

**New**:
```go
url := fmt.Sprintf("%s/models/gemini-3.1-flash-tts-preview:generateContent?key=%s", baseURL, c.apiKey)
```

### 4.2 Update Package Documentation

**File**: `backend/internal/gemini/client.go`

Update the package comment (line ~5-9) to reference the new model:
```go
// It supports two operations: voice recommendation (using gemini-3-flash-preview
// with structured JSON output) and text-to-speech generation (using
// gemini-3.1-flash-tts-preview with AUDIO response modality).
```

### 4.3 Add Language Code Support to `GenerateTTS`

**File**: `backend/internal/gemini/client.go`

Update the `GenerateTTS` function signature to accept an optional language code:

```go
func (c *Client) GenerateTTS(text, voiceName, systemInstruction, languageCode string) (string, error) {
```

Add `languageCode` to the `speechConfig` if provided:

```go
voiceConfig := map[string]any{
    "prebuiltVoiceConfig": map[string]any{
        "voiceName": voiceName,
    },
}

speechConfig := map[string]any{
    "voiceConfig": voiceConfig,
}

if languageCode != "" {
    speechConfig["languageCode"] = languageCode
}
```

### 4.4 Add Multi-Speaker TTS Method (Future)

**File**: `backend/internal/gemini/client.go`

Add a new method for multi-speaker generation:

```go
// GenerateMultiSpeakerTTS calls Gemini TTS for multi-speaker dialogue.
func (c *Client) GenerateMultiSpeakerTTS(text string, speakers []SpeakerConfig, languageCode string) (string, error) {
    speakerConfigs := make([]map[string]any, len(speakers))
    for i, s := range speakers {
        speakerConfigs[i] = map[string]any{
            "speaker": s.Speaker,
            "voiceConfig": map[string]any{
                "prebuiltVoiceConfig": map[string]any{
                    "voiceName": s.VoiceName,
                },
            },
        }
    }

    speechConfig := map[string]any{
        "multiSpeakerVoiceConfig": map[string]any{
            "speakerVoiceConfigs": speakerConfigs,
        },
    }

    if languageCode != "" {
        speechConfig["languageCode"] = languageCode
    }

    reqBody := map[string]any{
        "contents": []map[string]any{
            {
                "parts": []map[string]any{
                    {"text": text},
                },
            },
        },
        "generationConfig": map[string]any{
            "responseModalities": []string{"AUDIO"},
            "speechConfig":       speechConfig,
        },
    }

    // ... same request/response handling as GenerateTTS ...
}
```

### 4.5 Add Retry Logic for Intermittent 500 Errors

The official docs note that the model occasionally returns text tokens instead of audio tokens, causing a `500` error. Add automated retry:

**File**: `backend/internal/gemini/client.go`

```go
const maxTTSRetries = 3

// In GenerateTTS, wrap the HTTP call in a retry loop:
for attempt := 0; attempt < maxTTSRetries; attempt++ {
    resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(data))
    // ... handle response ...
    if resp.StatusCode == http.StatusInternalServerError && attempt < maxTTSRetries-1 {
        time.Sleep(time.Duration(attempt+1) * 500 * time.Millisecond)
        continue
    }
    // ... process successful response ...
}
```

### 4.6 Update Types

**File**: `backend/internal/gemini/types.go`

```go
// TTSRequest is the payload from the frontend for TTS generation.
type TTSRequest struct {
    Text              string `json:"text"`
    VoiceName         string `json:"voiceName"`
    SystemInstruction string `json:"systemInstruction,omitempty"`
    LanguageCode      string `json:"languageCode,omitempty"`
}

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

### 4.7 Update Handler

**File**: `backend/internal/handler/api_voices.go`

The handler currently calls (line ~101):
```go
audioBase64, err := client.GenerateTTS(req.Text, req.VoiceName, req.SystemInstruction)
```

Update to pass language code:
```go
audioBase64, err := client.GenerateTTS(req.Text, req.VoiceName, req.SystemInstruction, req.LanguageCode)
```

**File**: `backend/internal/server/routes.go`

Add a new route for multi-speaker TTS:
```go
mux.HandleFunc("POST /api/voices/tts/multi", voicesH.GenerateMultiSpeakerTTS)
```

### 4.8 Update Recommendation Model Reference (Optional)

The `Recommend` function currently uses `gemini-3-flash-preview` (line ~131 in `client.go`). This is independent of TTS and does not need to change for the TTS upgrade. However, if a newer text-generation model becomes available, it could be updated separately.

---

## 5. Frontend Changes (React/TypeScript)

### 5.1 Update Types

**File**: `types.ts`

Add language code to existing interfaces and new multi-speaker types:

```typescript
// Add to existing types or create new ones:
interface AudioTag {
  tag: string;
  label: string;
  category: 'emotion' | 'action' | 'style';
}

interface SpeakerConfig {
  speaker: string;
  voiceName: string;
}
```

### 5.2 Update API Client

**File**: `api.ts`

Update `generateTts` to accept optional `languageCode`:

```typescript
export async function generateTts(
  text: string,
  voiceName: string,
  systemInstruction?: string,
  languageCode?: string
): Promise<string> {
  const body: Record<string, string> = { text, voiceName };
  if (systemInstruction) body.systemInstruction = systemInstruction;
  if (languageCode) body.languageCode = languageCode;
  const data = await request<{ audioBase64: string }>('/voices/tts', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return data.audioBase64;
}
```

Add multi-speaker function:

```typescript
export async function generateMultiSpeakerTts(
  text: string,
  speakers: SpeakerConfig[],
  languageCode?: string
): Promise<{ audioBase64: string }> {
  const body: Record<string, any> = { text, speakers };
  if (languageCode) body.languageCode = languageCode;
  const res = await fetch('/api/voices/tts/multi', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### 5.3 Audio Tags Toolbar Component (New)

**File**: `components/AudioTagsToolbar.tsx`

A new component providing quick-insert buttons for common audio tags:

```tsx
const COMMON_TAGS = [
  { tag: '[whispers]', label: 'Whisper', category: 'style' },
  { tag: '[shouting]', label: 'Shout', category: 'style' },
  { tag: '[excited]', label: 'Excited', category: 'emotion' },
  { tag: '[sighs]', label: 'Sigh', category: 'action' },
  { tag: '[laughs]', label: 'Laugh', category: 'action' },
  { tag: '[gasps]', label: 'Gasp', category: 'action' },
  { tag: '[giggles]', label: 'Giggle', category: 'action' },
  { tag: '[sarcastic]', label: 'Sarcastic', category: 'emotion' },
  { tag: '[panicked]', label: 'Panicked', category: 'emotion' },
  { tag: '[tired]', label: 'Tired', category: 'emotion' },
  { tag: '[serious]', label: 'Serious', category: 'emotion' },
  { tag: '[curious]', label: 'Curious', category: 'emotion' },
  // ... more tags
];
```

Integrate into `ScriptReaderModal.tsx` above the text input area.

### 5.4 Language Selector

**File**: `components/ScriptReaderModal.tsx` and `components/AiTtsPreview.tsx`

Add a language dropdown. The model auto-detects language, so this is optional but helpful for disambiguation:

```tsx
const LANGUAGES = [
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
  // ... 60+ more
];
```

### 5.5 Update ScriptReaderModal for Multi-Speaker Mode

Add a toggle for dialogue mode with two voice selectors and speaker label formatting.

### 5.6 Update Constants (Optional)

**File**: `constants.ts`

The voice list remains the same 30 voices. No changes needed unless Google adds new voices in a future update.

---

## 6. API Contract Changes

### Updated Endpoints

#### `POST /api/voices/tts` (Updated)

**Request body** — add optional `languageCode`:
```json
{
  "text": "Hello world!",
  "voiceName": "Puck",
  "systemInstruction": "## Audio Profile\n...",
  "languageCode": "en"
}
```

**Response** — unchanged:
```json
{
  "audioBase64": "base64-encoded-pcm-data"
}
```

#### `POST /api/voices/tts/multi` (New)

**Request body**:
```json
{
  "text": "Speaker1: Hello!\nSpeaker2: Hi there!",
  "speakers": [
    { "speaker": "Speaker1", "voiceName": "Puck" },
    { "speaker": "Speaker2", "voiceName": "Kore" }
  ],
  "languageCode": "en"
}
```

**Response**:
```json
{
  "audioBase64": "base64-encoded-pcm-data"
}
```

---

## 7. Audio Tags Reference

The model supports a wide range of inline audio tags. Tags are placed in square brackets within the transcript text.

### Commonly Used Tags

| Tag | Effect |
|---|---|
| `[whispers]` | Whispered delivery |
| `[shouting]` | Raised voice, shouting |
| `[excited]` | Excited, energetic tone |
| `[sighs]` | Audible sigh |
| `[gasps]` | Sharp intake of breath |
| `[laughs]` | Laughter |
| `[giggles]` | Light giggling |
| `[crying]` | Tearful delivery |
| `[sarcastic]` | Sarcastic inflection |
| `[serious]` | Serious, grave tone |
| `[curious]` | Questioning, curious tone |
| `[amazed]` | Awestruck delivery |
| `[panicked]` | Frantic, panicked |
| `[tired]` | Weary, fatigued |
| `[trembling]` | Shaking, nervous voice |
| `[mischievously]` | Playful, scheming tone |
| `[short pause]` | Brief pause in speech |
| `[cough]` | Coughing sound |
| `[yawn]` | Yawning |

### Extended Emotion Tags

```
[admiration], [agitation], [anger], [annoyance], [anticipation], [anxiety],
[appreciation], [approval], [astonishment], [awe], [boredom], [caution],
[compassion], [confidence], [confusion], [contempt], [curiosity],
[determination], [disappointment], [disapproval], [disgust], [doubt],
[eagerness], [embarrassment], [empathy], [encouraging], [enjoyment],
[enthusiasm], [excitement], [fear], [frustration], [gratitude], [happy],
[hope], [horror], [interest], [joy], [love], [negative], [nervousness],
[neutral], [optimism], [pain], [positive], [sadness], [sarcasm],
[satisfaction], [surprise]
```

### Usage Example

```
[excitedly] Yes, massive vibes in the studio! You are locked in and it is
absolutely popping off in London right now. If you're stuck on the tube, or
just sat there pretending to work... stop it. Seriously, I see you.
[shouting] Turn this up! We've got the project roadmap landing in three,
two... let's go!
```

> **Tip**: Audio tags work best in English even when the transcript is in another language.

---

## 8. Multi-Speaker Support

### How It Works

Multi-speaker TTS uses `MultiSpeakerVoiceConfig` instead of `VoiceConfig` in the `speechConfig`:

```json
{
  "generationConfig": {
    "responseModalities": ["AUDIO"],
    "speechConfig": {
      "multiSpeakerVoiceConfig": {
        "speakerVoiceConfigs": [
          {
            "speaker": "Joe",
            "voiceConfig": {
              "prebuiltVoiceConfig": { "voiceName": "Kore" }
            }
          },
          {
            "speaker": "Jane",
            "voiceConfig": {
              "prebuiltVoiceConfig": { "voiceName": "Puck" }
            }
          }
        ]
      }
    }
  }
}
```

### Prompt Format

Speaker names in the prompt must match the `speaker` field in the config:

```
Joe: How's it going today Jane?
Jane: Not too bad, how about you?
```

You can also add per-speaker style directions:

```
Make Joe sound tired and bored, and Jane sound excited and happy:

Joe: So... [yawn] what's on the agenda today?
Jane: You're never going to guess!
```

### Constraints

- Maximum **2 speakers** per request
- Speaker names in prompt must exactly match config names
- Each speaker can have a different voice from the 30 available voices

---

## 9. Language Support Expansion

### Full Language List (70+ Languages)

The model now supports automatic language detection for these languages:

**Major Languages**: Arabic, Bangla, Chinese (Mandarin), Dutch, English, French, German, Hindi, Indonesian, Italian, Japanese, Korean, Marathi, Polish, Portuguese, Romanian, Russian, Spanish, Tamil, Telugu, Thai, Turkish, Ukrainian, Vietnamese

**Additional Languages**: Afrikaans, Albanian, Amharic, Armenian, Azerbaijani, Basque, Belarusian, Bulgarian, Burmese, Catalan, Cebuano, Croatian, Czech, Danish, Estonian, Filipino, Finnish, Galician, Georgian, Greek, Gujarati, Haitian Creole, Hebrew, Hungarian, Icelandic, Javanese, Kannada, Konkani, Lao, Latin, Latvian, Lithuanian, Luxembourgish, Macedonian, Maithili, Malagasy, Malay, Malayalam, Mongolian, Nepali, Norwegian (Bokmål), Norwegian (Nynorsk), Odia, Pashto, Persian, Punjabi, Serbian, Sindhi, Sinhala, Slovak, Slovenian, Swahili, Swedish, Urdu

### Implementation Notes

- Language detection is automatic — no `languageCode` required in most cases
- Providing an explicit `languageCode` helps when text is ambiguous or multilingual
- Audio tags should remain in English even for non-English transcripts for best results
- All 30 voices work across all languages

---

## 10. Pricing Impact

### Price Comparison (per 1M tokens)

| Model | Input (Text) | Output (Audio) | Free Tier |
|---|---|---|---|
| **gemini-2.5-pro-preview-tts** | $1.00 | $20.00 | ❌ Not available |
| **gemini-2.5-flash-preview-tts** | $0.50 | $10.00 | ✅ Free of charge |
| **gemini-3.1-flash-tts-preview** | $1.00 | $20.00 | ✅ Free of charge |

### Key Pricing Notes

- **Free tier**: 3.1 Flash TTS has a **free standard tier** (used to improve products), making it accessible for development and low-volume use. The 2.5 Pro TTS had no free tier.
- **Paid tier**: Same pricing as 2.5 Pro TTS ($1.00 input / $20.00 output per 1M tokens)
- **Batch API**: Available for 3.1 Flash TTS, offering potential 50% cost savings for batch workloads
- **Audio token rate**: 25 tokens per second of audio output
- **Cost-effective alternative**: If cost is a concern, `gemini-2.5-flash-preview-tts` remains available at $0.50/$10.00 with a free tier

### Recommendation

For this application, **upgrading to 3.1 Flash TTS is cost-neutral or better** because:
1. Same paid pricing as 2.5 Pro TTS
2. **Gains a free tier** for development
3. Better quality and expressivity
4. Lower latency (Flash vs Pro class)
5. Batch API support for future optimization

---

## 11. Known Limitations & Mitigations

### From Official Documentation

| Limitation | Impact | Mitigation |
|---|---|---|
| **Voice inconsistency with prompt instructions** | Audio may not match selected speaker style | Ensure prompt tone aligns with voice characteristics. E.g., don't pair a deep male voice with "young girl" instructions. |
| **Occasional text token returns** | Random 500 errors (~small %) | Implement automated retry logic (3 retries with exponential backoff) |
| **Prompt classifier false rejections** | `PROHIBITED_CONTENT` errors or model reading instructions aloud | Add clear preamble instructing speech synthesis; explicitly label transcript section |
| **Input token limit: 8,192** | Shorter prompts than 2.5 Pro's 32k | Monitor prompt length; chunk very long scripts |
| **No streaming** | Cannot stream partial audio | Continue using full-response pattern |
| **Text-only input** | No audio/image/video inputs | Already the current pattern |
| **No context caching** | Cannot cache prompts | N/A for our use case |

### Application-Specific Considerations

1. **System instruction handling**: Our current approach of prepending system instructions to the transcript text (stripping/re-adding `## Transcript`) will continue to work. The new model's prompt structure (Audio Profile → Scene → Director's Notes → Transcript) aligns with what our AI Casting Director already generates.

2. **Audio tags in user text**: Users may type audio tags `[whispers]` etc. directly in the Script Reader. These will flow through to the API naturally — no special parsing needed.

3. **Prompt length monitoring**: With the reduced 8,192 token input limit, add a character/token count indicator in the Script Reader to warn users when approaching the limit.

---

## 12. Migration Steps

### Phase 1: Core Model Swap (Minimal Changes)

This gets the app running on the new model with improved quality immediately.

**Estimated scope**: 3 files changed

1. **`backend/internal/gemini/client.go`**
   - Change model name from `gemini-2.5-pro-preview-tts` to `gemini-3.1-flash-tts-preview` in the URL
   - Update package documentation comment
   - Add retry logic for intermittent 500 errors

2. **Test**: Build backend, run existing TTS flows (stock voices, custom presets, Script Reader)

### Phase 2: Language Support

**Estimated scope**: 5 files changed

1. **`backend/internal/gemini/types.go`** — Add `LanguageCode` field to `TTSRequest`
2. **`backend/internal/gemini/client.go`** — Accept `languageCode` parameter, include in `speechConfig`
3. **`backend/internal/handler/api_voices.go`** — Pass `req.LanguageCode` to client
4. **`api.ts`** — Add `languageCode` parameter to `generateTts()`
5. **`components/AiTtsPreview.tsx`** and/or **`components/ScriptReaderModal.tsx`** — Add language dropdown

### Phase 3: Audio Tags UI

**Estimated scope**: 2-3 files changed/created

1. **`components/AudioTagsToolbar.tsx`** — New component with quick-insert buttons
2. **`components/ScriptReaderModal.tsx`** — Integrate AudioTagsToolbar above textarea
3. **`constants.ts`** or new **`audioTags.ts`** — Define available tags with categories

### Phase 4: Multi-Speaker Support (Future)

**Estimated scope**: 6-8 files changed/created

1. **`backend/internal/gemini/types.go`** — Add `MultiSpeakerTTSRequest`, `SpeakerConfig`
2. **`backend/internal/gemini/client.go`** — Add `GenerateMultiSpeakerTTS` method
3. **`backend/internal/handler/api_voices.go`** — Add `POST /api/voices/tts/multi` handler
4. **`backend/internal/server/routes.go`** — Register new route
5. **`api.ts`** — Add `generateMultiSpeakerTts()` function
6. **`types.ts`** — Add `SpeakerConfig` interface
7. **`components/ScriptReaderModal.tsx`** — Add dialogue mode toggle, dual voice selector
8. **`components/AiTtsPreview.tsx`** — Support multi-speaker playback

---

## 13. Testing Checklist

### Phase 1 Tests

- [ ] Single-speaker TTS with stock voice (Puck, Kore, Zephyr, etc.)
- [ ] Custom preset TTS with system instruction
- [ ] Script Reader with stock voice
- [ ] Script Reader with custom voice preset
- [ ] WAV download produces valid audio
- [ ] Audio plays correctly in browser (24kHz PCM)
- [ ] Retry logic handles intermittent 500s gracefully
- [ ] Long text input (approaching 8k token limit)
- [ ] Error handling for rejected/prohibited content

### Phase 2 Tests

- [ ] Language auto-detection works without `languageCode`
- [ ] Explicit `languageCode` produces speech in correct language
- [ ] French, Spanish, German, Japanese, Korean, Chinese text
- [ ] Mixed-language text with explicit `languageCode`
- [ ] Language dropdown defaults to "Auto-detect"

### Phase 3 Tests

- [ ] Audio tags toolbar renders correctly
- [ ] Clicking a tag inserts it at cursor position in textarea
- [ ] Tags like `[whispers]`, `[shouting]`, `[excited]` produce audible effects
- [ ] Tags work correctly within system instruction context

### Phase 4 Tests

- [ ] Two-speaker dialogue with distinct voices
- [ ] Speaker names match between prompt and config
- [ ] Per-speaker style directions work
- [ ] Multi-speaker audio saves and replays from history

---

## 14. Rollback Plan

If issues arise with 3.1 Flash TTS:

1. **Revert model name**: Change `gemini-3.1-flash-tts-preview` back to `gemini-2.5-pro-preview-tts` in `client.go`
2. **Alternative**: Switch to `gemini-2.5-flash-preview-tts` (free tier, lower cost, slightly lower quality)
3. **Feature flags**: Consider adding a model selector in the backend config so the TTS model can be changed without code changes:

```go
// In config.go
type Config struct {
    // ...
    TTSModel string `json:"tts_model"` // default: "gemini-3.1-flash-tts-preview"
}
```

This allows switching between models via the config file or environment variable without redeployment.

---

## References

- [Gemini 3.1 Flash TTS Blog Post](https://blog.google/innovation-and-ai/models-and-research/gemini-models/gemini-3-1-flash-tts/)
- [Gemini 3.1 Flash TTS Model Card](https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-tts-preview)
- [Text-to-Speech Generation Guide](https://ai.google.dev/gemini-api/docs/speech-generation)
- [Prompting Guide & Audio Tags](https://ai.google.dev/gemini-api/docs/speech-generation#transcript-tags)
- [Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Voice Library (AI Studio)](https://aistudio.google.com/apps/bundled/voice-library)
- [TTS Playground (AI Studio)](https://aistudio.google.com/generate-speech)
- [SynthID Model Card](https://deepmind.google/models/model-cards/gemini-3-1-flash-audio/)
- [TTS Cookbook (GitHub)](https://colab.research.google.com/github/google-gemini/cookbook/blob/main/quickstarts/Get_started_TTS.ipynb)
