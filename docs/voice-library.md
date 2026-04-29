# Voice Studio

The Voice Studio is the main browsing surface for discovering, previewing, and selecting from 30 curated Google Gemini TTS voices.

---

## Browsing Voices

### 3D Carousel View

The default view renders voices as a depth-stacked 3D carousel with perspective projection. The active voice is centered and enlarged; adjacent voices recede into the background.

**Navigation:**
- **Arrow keys** — Move left/right through voices
- **Click a card** — Jump directly to that voice
- **Drag** — Swipe/drag horizontally to move through voices
- **Enter or Space** — Play a sample for the currently focused voice

### Grid View

Click the **Grid** icon in the top navigation bar to switch to a responsive card grid layout.

- 1 column on mobile
- 2 columns on small screens
- 3 columns on large screens
- 4 columns on extra-large screens

Each card shows the voice portrait, name, pitch, and trait tags. Click any card to select it.

### Switching Views

The view mode toggle is in the **FilterBar** (top navigation). The selected view persists across sessions.

---

## Voice Metadata

Each voice card displays:

| Field | Description |
|-------|-------------|
| **Name** | Mythological name (e.g., Zephyr, Puck, Charon) |
| **Pitch** | Higher, Medium, or Lower |
| **Characteristics** | 2–4 short trait descriptions |
| **Gender** | Male, Female, or Neutral (from analysis) |
| **Image** | AI-generated portrait artwork |

Click any card to see the full detail view including the complete trait list and audio controls.

---

## Filtering Voices

The **FilterBar** at the top provides three filter controls:

| Filter | Options |
|--------|---------|
| **Search** | Free-text search across voice name and characteristics |
| **Gender** | All, Male, Female, Neutral |
| **Pitch** | All, Higher, Medium, Lower |

Filters are applied simultaneously. The voice count shown updates as filters change.

---

## Favorites

Click the **star icon** on any voice card to mark it as a favorite.

- Favorites are stored server-side and persist across sessions and devices
- Filter to favorites only using the **Favorites** quick filter in the FilterBar
- Unfavorite by clicking the star again

---

## Voice Samples

Each voice has a **pre-recorded audio sample** hosted by Google. Click the **Play** button on any voice card to hear it.

- Samples use standard `<audio>` elements for low-overhead playback
- The **Mini Player** (bottom of screen) shows currently playing audio and lets you control it from anywhere in the app

---

## Voice Comparison

Click **Compare** in the FilterBar (or from a voice card's action menu) to open the **Voice Compare** panel.

1. Select **Voice A** and **Voice B** from the dropdowns
2. Enter any text you want both voices to read
3. Click **Generate Both** to run TTS for both voices simultaneously
4. Listen to each result independently with play/pause controls
5. Download either result as a WAV file

---

## AI Casting Director

For situations where you know what you *want* but not which voice fits, the **AI Casting Director** analyzes your description and recommends the top 3 voices from the library.

See [AI Casting](ai-casting.md) for full documentation.

---

## My Voices (Custom Presets)

The **My Voices** tab (accessible from the FilterBar's tab strip) shows your custom voice presets — voices you've saved from AI Casting results with specific persona instructions.

Click the **My Voices** tab to switch to the preset browser. Custom presets support the same carousel and grid views as the stock library.

See [My Voices](#) for full documentation on creating and managing presets.

---

## AI Casting Director

Described more fully on the [AI Casting](ai-casting.md) page, the Casting Director is accessible from:

- The **Find My Voice** button in the FilterBar
- The **Wand** icon in the top navigation

---

## Navigation Tips

- Use **Cmd/Ctrl+K** to open the Command Palette and type a voice name to jump directly to it
- The **Onboarding Tour** (accessible from **Help** in the sidebar) covers the Voice Studio in its first step
