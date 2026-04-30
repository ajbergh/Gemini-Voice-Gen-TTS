# Settings & Administration

This guide covers API key management, cache, backup/restore, pronunciation dictionaries, performance styles, QC rules, and render defaults.

---

## Opening Settings

Click the **Settings** (gear icon) in the left navigation sidebar to open the Settings modal.

![Settings modal showing the API Keys tab with key input and Key Rotation Pool](../assets/screenshots/13-settings-dark.png)
*The Settings modal provides tabs for Keys, Render defaults, Export profiles, Dictionaries, QC rules, Storage, and Appearance*

---

## API Keys

### Adding an API Key

1. Go to **Settings → API Keys**
2. Paste your Gemini API key in the input field
3. Click **Test** to validate the key against the Gemini API
4. Click **Save**

The key is encrypted with AES-256-GCM and stored in the local SQLite database. It is never stored in plain text.

> **Get a key:** [Google AI Studio → Create API Key](https://aistudio.google.com/apikey)

### Testing a Key

Click **Test Key** next to any saved key. The backend sends a minimal validation request to Gemini and reports success or failure. A failed test does not delete the key.

### Deleting a Key

Click **Delete** next to the key. Confirmation is required. After deletion, any future API calls that require Gemini will fail until a new key is saved.

---

## Key Pool

For high-volume use, multiple API keys can be pooled. The backend rotates across pool entries to distribute load and avoid per-key rate limits.

### Adding to the Pool

1. Go to **Settings → API Keys → Pool**
2. Click **Add Key to Pool**
3. Paste the key and click **Add**

### Pool Management

| Action | Description |
|--------|-------------|
| **View pool** | See all pool entries with usage counts |
| **Reset usage** | Reset the rotation counter for the pool |
| **Remove entry** | Delete a single key from the pool |

---

## Render Defaults

Global defaults applied to all new segments across all projects (unless overridden at the project or segment level).

| Setting | Description |
|---------|-------------|
| **Default Model** | TTS model: `gemini-3.1-flash-tts-preview` (default), `gemini-2.5-flash-preview-tts` |
| **Default Voice** | Stock voice or custom preset for new segments |
| **Default Language** | Language code (e.g., `en-US`) or auto-detect |

---

## Pronunciation Dictionaries

### Global Pronunciation Dictionaries

Global dictionaries apply their rules to all TTS generation across all projects, evaluated before any project-scoped rules.

**Creating a global dictionary:**
1. Go to **Settings → Pronunciation → Global**
2. Click **New Dictionary**
3. Enter a dictionary name
4. Click **Save**

**Adding entries:**
1. Select a dictionary from the list
2. Click **+ Add Entry**
3. Enter the **Word or Phrase** and the **Pronunciation Override**
4. Click **Save Entry**

The pronunciation override is passed to the TTS model as a phonetic or alternate spelling hint in the system instruction.

**Real-time preview:**
- Enter sample text in the **Preview** field
- The dictionary transforms the text in real time so you can verify rules work as intended

**Toggling dictionaries:**
- Each dictionary has an **Active / Inactive** toggle
- Inactive dictionaries are excluded from all TTS requests

### Project-Scoped Pronunciation Dictionaries

Project-scoped dictionaries apply only within their project. They are evaluated after global dictionaries (global rules take precedence).

**Creating a project dictionary:**
1. Open a project and click the **Pronunciation** icon in the project toolbar, or
2. Go to **Settings → Pronunciation** and select a project
3. Follow the same steps as global dictionaries

---

## Performance Styles

Performance Styles are reusable direction presets injected into TTS system instructions.

### Global Styles

Available across all projects.

1. Go to **Settings → Performance Styles**
2. Click **New Style**
3. Fill in:

| Field | Description |
|-------|-------------|
| **Name** | Display name for the style |
| **Description** | Brief summary |
| **Category** | Narration, Commercial, Education, Character, Documentary, Meditation, Horror, Comedy |
| **Pacing** | Slow / Measured / Conversational / Brisk / Rapid |
| **Energy** | Subdued / Calm / Moderate / Engaged / High |
| **Emotion** | Neutral / Warm / Authoritative / Intimate / Dramatic / Playful / Suspenseful |
| **Articulation** | Relaxed / Clear / Crisp / Heightened |
| **Pause Density** | Sparse / Moderate / Frequent / Dramatic |
| **Director Notes** | Free-text direction injected into the system prompt |

4. Click **Save**

### Style Version History

Every save of a style creates a version snapshot. To revert:
1. Open the style editor
2. Click **View History**
3. Click **Revert** next to any prior version

---

## QC Rules

Configure default quality-control behavior.

1. Go to **Settings → QC Rules**

| Setting | Description |
|---------|-------------|
| **Default Severity** | Pre-selected issue severity: Low / Medium / High |
| **Auto-Flag Clipping** | Automatically flag segments with audio clipping detected |
| **Clipping Threshold (dBFS)** | Threshold for clipping detection (e.g., `-1.0`) |
| **Export Only Approved** | Only include approved takes in exports |
| **Notes Export Format** | QC notes export format: CSV or Markdown |

---

## Cache Management

Generated audio is cached on disk for fast re-playback without re-generating. Over time, cache can grow significantly for large projects.

**Viewing cache stats:**
1. Go to **Settings → Cache**
2. Stats show total cached files, total size, and per-type breakdown

**Clearing the cache:**
1. Click **Clear Cache**
2. Confirm the action

> **Note:** Clearing the cache removes audio files from disk. History entries remain in the database but will need to re-generate audio on next playback.

---

## Backup & Restore

### Creating a Backup

1. Go to **Settings → Backup**
2. Click **Create Backup**
3. A JSON export of the entire database is downloaded

The backup includes all projects, segments, takes, cast profiles, presets, history, API keys (encrypted), and configuration.

**API equivalent:**
```bash
curl -X POST http://localhost:8080/api/backup -o backup.json
```

### Restoring from Backup

1. Go to **Settings → Backup**
2. Click **Restore from File**
3. Select the backup JSON file
4. Confirm — the current database is replaced

> **Warning:** Restore overwrites all current data. Create a new backup first if you want to preserve the current state.

**API equivalent:**
```bash
curl -X POST http://localhost:8080/api/restore -F "file=@backup.json"
```

---

## Export Profiles

Export Profiles define finishing settings for deliverable packaging.

1. Go to **Settings → Export Profiles**
2. Click **New Profile**
3. Configure:

| Setting | Options |
|---------|---------|
| **Name** | Display name |
| **Format** | WAV, MP3, FLAC |
| **Sample Rate** | 24kHz, 44.1kHz, 48kHz |
| **Bit Depth** | 16-bit, 24-bit, 32-bit |
| **Normalization** | None, Peak, Loudness (LUFS) |
| **Target Loudness** | e.g., `-16` LUFS for podcast, `-23` LUFS for broadcast |
| **Include Metadata** | Embed ID3/BWF metadata tags |

Profiles appear in the **Export Profile** dropdown in the project Export dialog and the Timeline stitch toolbar.

---

## App Configuration

Low-level configuration is accessible via `GET/PUT /api/config` or through Settings:

| Key | Description |
|-----|-------------|
| `default_model` | Global default TTS model |
| `default_voice` | Global default voice name |
| `default_language` | Global default language code |
| `theme` | `light` or `dark` |
| `accent_color` | UI accent color: indigo, blue, violet, rose, emerald, amber |

---

## Client Workspaces

Clients allow organizing projects under brand contexts.

1. Go to **Settings → Clients** or click **Clients** in the navigation sidebar
2. Click **New Client**
3. Fill in:
   - **Name** — Brand or client name
   - **Description** — Optional brand summary
   - **Brand Notes** — Notes on voice preferences, style guidelines
   - **Default Voice** — Voice used for new projects under this client
   - **Default Model** — TTS model used for this client's projects
4. Click **Save**

When creating a new project, select the client to inherit its defaults.
