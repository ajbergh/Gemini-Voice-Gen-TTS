# Projects

The Projects workspace is the full production pipeline for multi-segment voiceover, audiobook, podcast, and training audio. It provides section and segment management, per-segment voice assignment, batch rendering, take history, cast management, pronunciation dictionaries, review/QC workflows, and deliverable export.

---

## Getting Started with Projects

### Opening Projects

Click **Projects** in the left navigation sidebar. If no project is open, a project picker appears. Select an existing project or create a new one.

The app remembers your last-opened project and restores it automatically on the next launch.

### Creating a Project

1. Click **New Project** in the project picker or header
2. Enter a **Project Title**
3. Select a **Project Type**:
   - **Audiobook** — Long-form narration with chapters
   - **Voiceover** — Short-form video or ad narration
   - **Podcast** — Multi-speaker episodic audio
   - **Training** — E-learning or instructional audio
   - **Custom** — Freeform structure
4. Optionally assign the project to a **Client Workspace**
5. Click **Create**

---

## Project Layout

The Project Workspace has several tabs across the top:

| Tab | Content |
|-----|---------|
| **Script** | Inline section and segment editor (main editing surface) |
| **Cast** | Cast bible (character/narrator profiles) |
| **Review** | Take review, QC, approval workflow |
| **Timeline** | Waveform timeline and export readiness |
| **Export** | Package and download deliverable |

The **Project Settings** drawer slides in from the right when you click the settings gear icon. The **Project Stats Bar** above the script shows section, segment, and draft counts.

---

## Script Tab: Sections and Segments

### Structure

A project is organized as a tree:

```
Project
└── Section (Chapter 1, Scene A, etc.)
    ├── Segment (line/paragraph to render)
    ├── Segment
    └── Segment
```

### Working with Sections

**Add a section:**
- Click **+ Add Section** at the bottom of the script

**Rename a section:**
- Click the pencil icon next to the section title
- Edit the name and press **Enter** to confirm

**Section kinds:**
- Chapter
- Scene
- Folder
- Intro / Outro

**Collapse/expand a section:**
- Click the arrow icon next to the section title to hide or show its segments

**Delete a section:**
- Click the trash icon (requires confirmation)

### Working with Segments

Each segment represents one individual piece of audio to render — a line of dialogue, a paragraph of narration, etc.

**Add a segment:**
- Click **+ Add Segment** inside any section
- Type the segment text and press **Save**

**Edit a segment:**
- Click the pencil icon on the segment row
- Editable fields:
  - **Text** — The spoken content
  - **Speaker Label** — Name or role of the speaker (used by Cast system)
  - **Voice** — Stock voice or custom preset
  - **Cast Profile** — Link to a named cast profile (overrides voice)
  - **Performance Style** — Optional style preset for delivery direction
  - **Language Code** — Override language for this segment
  - **Provider / Model** — TTS provider and model (e.g., `gemini-3.1-flash-tts-preview`)
- Click **Save** to apply or **Cancel** to discard

**Render a segment:**
- Click the **Render** button (waveform icon) on a segment row
- The segment status changes to **Rendering** and updates to **Rendered** when complete
- Rendered audio becomes a new **take** in the segment's take list

**Delete a segment:**
- Click the trash icon (requires confirmation)

### Segment Status Badges

| Status | Meaning |
|--------|---------|
| **Draft** | Not yet rendered |
| **Rendering** | Currently being processed |
| **Rendered** | Audio generated, not yet reviewed |
| **Approved** | Take is approved for export |
| **Flagged** | Take has issues, needs re-recording |
| **Changed** | Text was edited after last render |

---

## Batch Render

Click **Batch Render** in the toolbar to render all draft and changed segments at once.

Options:
- **All draft/changed** — Default; renders only segments that need audio
- **Force re-render all** — Re-renders every segment regardless of status

Progress is shown in real time via the **Job Center** drawer. Cancel the job at any time by clicking **Cancel** in the Job Center.

---

## Text Import

Click **Import** (upload icon in the toolbar) to load a Markdown or plain text file as sections and segments.

How the import works:
- `# Heading 1` and `## Heading 2` lines become **Section** titles
- Paragraphs and lines below each heading become **Segments**
- Import is previewed before applying — review the structure, then confirm

You can also paste text directly into the import panel.

---

## AI Script Prep

Click **Script Prep** (AI wand icon) to open the AI Script Preparation dialog.

1. Paste raw manuscript text (plain text or Markdown)
2. Click **Analyze**
3. Gemini returns a proposed structure including:
   - Sections with titles
   - Segments with speaker labels
   - Speaker candidates (cast profile suggestions)
   - Pronunciation suggestions
   - Performance style recommendations
   - Warnings (e.g., detected formatting issues)
4. Review the hierarchical preview
5. Click **Apply** to create all sections and segments at once

---

## Takes

Every time a segment is rendered, a new **take** is created. Segments can have multiple takes.

**Viewing takes:**
- Click the take-list indicator (clapperboard icon) on any segment row to expand the take list

**Take list shows:**
- Take number
- Voice used
- Status badge
- Duration
- Creation timestamp
- Reviewer notes

**Actions per take:**
- **Play** — Audition the take
- **Approve** — Mark as ready for export
- **Flag** — Mark as having issues
- **Add note** — Attach a reviewer comment
- **Delete** — Remove the take (double-click to confirm)

---

## Project Settings

Click the **Settings gear** in the project toolbar to open the Project Settings drawer.

| Setting | Description |
|---------|-------------|
| **Default Voice** | Stock voice or custom preset used for new segments |
| **Default Language** | Language code for new segments |
| **Default Model** | TTS model: 3.1 Flash (default), 2.5 Flash, 2.5 Pro |
| **Default Style** | Performance style preset applied to new segments |

These defaults apply to newly created segments. Individual segments can override any setting.

---

## Project Statistics

The **Stats Bar** above the script editor shows live counts:

- **Sections** — Total sections in the project
- **Segments** — Total segments
- **Drafts** — Segments not yet rendered (need audio)

---

## Client Workspaces

Organize projects under named client brands.

1. Click **Clients** in the sidebar
2. Create a client with a name, brand notes, and default voice/model settings
3. When creating a new project, assign it to a client

Client defaults (voice, model, language) are inherited by new projects created under that client.

---

## Performance Styles

Performance Styles are reusable direction presets that shape how the TTS model delivers text.

| Field | Options |
|-------|---------|
| **Pacing** | Slow, Measured, Conversational, Brisk, Rapid |
| **Energy** | Subdued, Calm, Moderate, Engaged, High |
| **Emotion** | Neutral, Warm, Authoritative, Intimate, Dramatic, Playful, Suspenseful |
| **Articulation** | Relaxed, Clear, Crisp, Heightened |
| **Pause Density** | Sparse, Moderate, Frequent, Dramatic |
| **Director Notes** | Free-text guidance injected into the system instruction |

**Creating a style:**
1. Click **+ New Style** in the Style Preset Picker dropdown, or
2. Go to **Settings → Performance Styles**

Styles can be **global** (available in all projects) or **project-scoped** (local to one project).

---

## Pronunciation Dictionaries

Per-project word/phrase → pronunciation overrides. See the [Settings & Administration](settings-administration.md) page for full documentation on both project-scoped and global pronunciation dictionaries.

---

## Next Steps

| Guide | Description |
|-------|-------------|
| [Cast Bible](cast-bible.md) | Set up character voice profiles |
| [Review & Export](review-export.md) | Review takes, QC, and export |
| [Settings & Administration](settings-administration.md) | Pronunciation, styles, and global settings |
