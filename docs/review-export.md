# Review & Export

This guide covers the full quality-control and delivery pipeline: reviewing takes, flagging issues, approving segments, and packaging the final deliverable.

---

## Review Mode

### Opening Review Mode

In any project, click the **Review** tab in the project navigation bar. Review Mode can also be opened in full-screen by clicking the **Expand** icon.

### Layout

Review Mode has three panels:

| Panel | Description |
|-------|-------------|
| **Review Queue** (left) | List of all segments with status indicators |
| **Take Player** (center) | Audio player with waveform and approval controls |
| **QC Issues** (right) | List of quality-control issues for the selected segment |

---

## Review Queue

The queue shows all project segments. Filter by status using the tabs at the top:

| Filter | Shows |
|--------|-------|
| **All** | Every segment |
| **Unreviewed** | Segments with no approve/flag decision |
| **Flagged** | Segments marked with issues |
| **Open Issues** | Segments that have unresolved QC issues |

Each row shows:
- Segment text preview
- Status icon (check = approved, flag = flagged, alert = open issues)
- QC issue count badge (when issues exist)

Click any row to load that segment's best take in the player.

---

## Take Player

The center panel plays the currently selected segment's take.

**Transport Controls:**

| Action | Button | Keyboard |
|--------|--------|----------|
| Play / Pause | ▶ / ⏸ | `Space` |
| Replay (restart) | ↩ | `R` |
| Previous segment | ⏮ | `P` |
| Next segment | ⏭ | `N` |
| Approve | ✓ | `A` |
| Flag | ⚑ | `F` |
| Add QC Marker | ◉ | `M` |

**Waveform:**
- Displays the waveform of the current take
- Click anywhere on the waveform to seek to that position

---

## Approving and Flagging Takes

### Approve

Click **Approve** (or press `A`) to mark the current take as ready for export.

- The segment status changes to **Approved**
- The segment row in the queue shows a green checkmark
- Approved takes are included in export

### Flag

Click **Flag** (or press `F`) to mark the current take as having issues.

- The segment status changes to **Flagged**
- The segment row shows an orange flag icon
- Flagged segments are excluded from export by default (configurable in QC Rules)

---

## QC Issues

QC Issues are structured notes attached to a specific segment documenting problems found during review.

### Creating a QC Issue

1. Press `M` or click **Add Marker** during review
2. The QC Issue dialog opens
3. Fill in:
   - **Severity**: Low (blue), Medium (yellow), High (red)
   - **Notes**: Description of the issue
4. Click **Save**

### Managing Issues

The **QC Issues panel** (right side of Review Mode) shows all issues for the selected segment.

| Action | How |
|--------|-----|
| **Resolve** | Click the checkmark icon — marks status as Resolved |
| **Won't Fix** | Click the X icon — marks status as Won't Fix |
| **Edit** | Click the pencil icon — edit severity or notes |
| **Delete** | Click the trash icon |

### Issue Statuses

| Status | Icon | Meaning |
|--------|------|---------|
| **Open** | Alert triangle | Active issue needing attention |
| **Resolved** | Checkmark | Issue addressed and fixed |
| **Won't Fix** | X | Issue acknowledged but not going to be corrected |

---

## QC Rules

Configure default QC behavior in **Settings → QC Rules** (or accessible from the gear icon in Review Mode):

| Setting | Description |
|---------|-------------|
| **Default Severity** | Pre-selected severity for new issues (Low/Medium/High) |
| **Auto-Flag Clipping** | Automatically flag segments with detected audio clipping |
| **Clipping Threshold** | dBFS level that triggers clipping detection (e.g., -1.0) |
| **Export Only Approved** | If enabled, only approved segments are included in export |
| **Notes Export Format** | CSV or Markdown for exported QC notes |

---

## Timeline Review

The **Timeline** tab provides a scrollable waveform view of all segments in sequence, useful for checking pacing and checking export readiness.

### Features

- **Waveform per segment** — Each segment row shows a visual waveform of its best take
- **Click to seek** — Click anywhere on a waveform to seek to that position in playback
- **Status badges** — Each row shows the segment's approval status
- **Collapse/expand rows** — Focus on specific sections by collapsing others

### Export Readiness Checklist

At the top of the Timeline tab, the readiness checklist shows:

- How many segments are approved out of total
- How many segments still have open QC issues
- Whether any segments are still in draft/changed state

### Render Missing Audio

If any segments are in draft or changed state, a **Render Missing** button appears. Click it to batch-render all segments that don't have current audio.

---

## Export

### Starting an Export

1. Click the **Export** tab in the project navigation bar
2. Optionally select an **Export Profile** (finishing settings)
3. Review the export readiness checklist
4. Click **Start Export**

A background job is created. Export progress appears in the **Job Center** drawer.

### Export Profiles

Export Profiles control how audio is processed during packaging:

| Setting | Options |
|---------|---------|
| **Format** | WAV, MP3, FLAC |
| **Bit Depth** | 16-bit, 24-bit, 32-bit |
| **Sample Rate** | 24kHz, 44.1kHz, 48kHz |
| **Normalization** | None, Peak, Loudness (LUFS) |
| **Target Loudness** | e.g., -16 LUFS for podcasts, -23 LUFS for broadcast |
| **Metadata** | Include/exclude ID3 or BWF metadata |

**Managing profiles:**
1. Go to **Settings → Export Profiles**
2. Click **New Profile** to create a named configuration
3. Profiles appear in the Export Profile dropdown in the Export dialog

### Downloading the Export

When the export job completes:

1. A **Download ZIP** button appears in the Export dialog
2. Click to download a ZIP archive containing all approved segments
3. The ZIP can be re-downloaded from the **Prior Exports** list

---

## Stitch to WAV

The Timeline tab provides a **Stitch to WAV** button that concatenates all approved segments into a single continuous WAV file.

1. Open the **Timeline** tab
2. Select an export profile from the dropdown
3. Click **Download Stitched WAV**

The stitched file is generated server-side and downloaded directly — no job required.

---

## Job Center

All background jobs (batch renders, exports, script prep) are visible in the **Job Center** drawer.

Click the **Jobs** icon (briefcase) in the left sidebar to open it.

| Column | Description |
|--------|-------------|
| **Type** | Job type (Render, Export, Script Prep, etc.) |
| **Status** | Running / Complete / Failed |
| **Progress** | Percentage complete with progress bar |
| **Age** | Relative timestamp (e.g., "5m ago") |
| **Actions** | Cancel (running) or Delete (completed/failed) |

---

## Tips

- Use keyboard shortcuts during review for maximum efficiency — `A` to approve, `F` to flag, `N/P` to navigate, no mouse required
- Configure **Auto-Flag Clipping** in QC Rules to automatically catch audio clipping artifacts before manual review
- Set **Export Only Approved** in QC Rules to prevent accidentally exporting unreviewed takes
- Export Profiles can be shared across projects for consistent delivery standards per client
