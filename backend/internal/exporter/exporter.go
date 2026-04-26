// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package exporter builds ZIP deliverable archives from approved segment takes.
//
// A ZIP archive contains:
//   - audio/*.wav      — one WAV file per segment that has an approved/rendered take
//   - project.json     — project, section, and segment metadata
//   - cast-bible.json  — cast profiles for the project
//   - pronunciation-dictionary.json — enabled pronunciation entries
//   - qc-notes.csv     — all QC issues for the project
//   - render-metadata.json — take render provenance (voice, model, hashes)
//   - README.txt        — short guide
package exporter

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// Config holds the dependencies for an export run.
type Config struct {
	Store          *store.Store
	AudioCacheDir  string
	ExportCacheDir string
}

// Run executes the export job synchronously, building a ZIP file at
// ExportCacheDir/{jobID}.zip and updating the job's status in the store.
// It is intended to be called from a goroutine.
func Run(ctx context.Context, cfg Config, jobID, projectID int64) {
	if err := cfg.Store.UpdateExportJobStatus(jobID, "running", nil, nil); err != nil {
		slog.Error("export: mark running", "job_id", jobID, "error", err)
	}

	outputPath, err := run(ctx, cfg, jobID, projectID)
	if err != nil {
		msg := err.Error()
		_ = cfg.Store.UpdateExportJobStatus(jobID, "failed", nil, &msg)
		slog.Error("export: job failed", "job_id", jobID, "error", err)
		return
	}
	_ = cfg.Store.UpdateExportJobStatus(jobID, "complete", &outputPath, nil)
	slog.Info("export: job complete", "job_id", jobID, "output", outputPath)
}

func run(ctx context.Context, cfg Config, jobID, projectID int64) (string, error) {
	if err := os.MkdirAll(cfg.ExportCacheDir, 0o700); err != nil {
		return "", fmt.Errorf("create export cache dir: %w", err)
	}

	project, err := cfg.Store.GetProject(projectID)
	if err != nil || project == nil {
		return "", fmt.Errorf("load project %d: %w", projectID, err)
	}
	sections, err := cfg.Store.ListProjectSections(projectID)
	if err != nil {
		return "", fmt.Errorf("load sections: %w", err)
	}
	segments, err := cfg.Store.ListProjectSegments(projectID)
	if err != nil {
		return "", fmt.Errorf("load segments: %w", err)
	}
	requireApprovedTakes := strings.EqualFold(cfg.Store.GetConfigValue(store.ConfigKeyQcExportOnlyApproved, "false"), "true")

	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)

	audioIndex := 1
	var renderItems []map[string]any

	type takeRef struct {
		TakeID       int64    `json:"take_id"`
		TakeNumber   int      `json:"take_number"`
		VoiceName    string   `json:"voice_name"`
		Provider     string   `json:"provider"`
		Model        string   `json:"model"`
		LanguageCode string   `json:"language_code"`
		DurationSec  *float64 `json:"duration_seconds,omitempty"`
		Status       string   `json:"status"`
		AudioFile    string   `json:"audio_file,omitempty"`
	}
	type segEntry struct {
		ID           int64    `json:"id"`
		SectionID    *int64   `json:"section_id,omitempty"`
		Title        string   `json:"title"`
		ScriptText   string   `json:"script_text"`
		SpeakerLabel string   `json:"speaker_label,omitempty"`
		Status       string   `json:"status"`
		SortOrder    int      `json:"sort_order"`
		BestTake     *takeRef `json:"best_take,omitempty"`
	}
	type secEntry struct {
		ID        int64  `json:"id"`
		Title     string `json:"title"`
		Kind      string `json:"kind"`
		SortOrder int    `json:"sort_order"`
	}
	type projectDoc struct {
		ExportedAt string     `json:"exported_at"`
		Project    any        `json:"project"`
		Sections   []secEntry `json:"sections"`
		Segments   []segEntry `json:"segments"`
	}

	var secEntries []secEntry
	for _, s := range sections {
		secEntries = append(secEntries, secEntry{s.ID, s.Title, s.Kind, s.SortOrder})
	}

	var segEntries []segEntry
	for _, seg := range segments {
		entry := segEntry{
			ID:           seg.ID,
			SectionID:    seg.SectionID,
			Title:        seg.Title,
			ScriptText:   seg.ScriptText,
			SpeakerLabel: derefStr(seg.SpeakerLabel),
			Status:       seg.Status,
			SortOrder:    seg.SortOrder,
		}

		take, err := cfg.Store.GetBestTakeForSegment(projectID, seg.ID)
		if err != nil {
			slog.Warn("export: get best take", "segment_id", seg.ID, "error", err)
		}
		if take != nil {
			if requireApprovedTakes && take.Status != "approved" {
				segEntries = append(segEntries, entry)
				continue
			}
			voice := derefStr(take.VoiceName)
			audioFile := ""

			if take.AudioPath != nil && *take.AudioPath != "" {
				pcmPath := filepath.Join(cfg.AudioCacheDir, filepath.Base(*take.AudioPath))
				pcm, rerr := os.ReadFile(pcmPath)
				if rerr == nil {
					wav := encodePCM16MonoWAV(pcm, 24000)
					safeName := sanitizeFilename(voice)
					audioFile = fmt.Sprintf("audio/%03d-%s.wav", audioIndex, safeName)
					if fw, werr := zw.Create(audioFile); werr == nil {
						_, _ = fw.Write(wav)
					}
					audioIndex++
				} else {
					slog.Warn("export: read pcm", "path", pcmPath, "error", rerr)
				}
			}

			entry.BestTake = &takeRef{
				TakeID:       take.ID,
				TakeNumber:   take.TakeNumber,
				VoiceName:    voice,
				Provider:     derefStr(take.Provider),
				Model:        derefStr(take.Model),
				LanguageCode: derefStr(take.LanguageCode),
				DurationSec:  take.DurationSeconds,
				Status:       take.Status,
				AudioFile:    audioFile,
			}

			renderItems = append(renderItems, map[string]any{
				"segment_id":      seg.ID,
				"take_id":         take.ID,
				"take_number":     take.TakeNumber,
				"voice_name":      voice,
				"provider":        derefStr(take.Provider),
				"model":           derefStr(take.Model),
				"language_code":   derefStr(take.LanguageCode),
				"app_voice_name":  derefStr(take.AppVoiceName),
				"provider_voice":  derefStr(take.ProviderVoice),
				"prompt_hash":     derefStr(take.PromptHash),
				"dictionary_hash": derefStr(take.DictionaryHash),
				"status":          take.Status,
				"audio_file":      audioFile,
			})
		}

		segEntries = append(segEntries, entry)
	}

	doc := projectDoc{
		ExportedAt: time.Now().UTC().Format(time.RFC3339),
		Project:    project,
		Sections:   secEntries,
		Segments:   segEntries,
	}
	if err := writeJSON(zw, "project.json", doc); err != nil {
		return "", err
	}

	castProfiles, _ := cfg.Store.ListCastProfiles(projectID)
	if err := writeJSON(zw, "cast-bible.json", map[string]any{"cast_profiles": castProfiles}); err != nil {
		return "", err
	}

	entries, _ := cfg.Store.ListEnabledEntriesForProject(projectID)
	if err := writeJSON(zw, "pronunciation-dictionary.json", map[string]any{"entries": entries}); err != nil {
		return "", err
	}

	qcIssues, _ := cfg.Store.ListProjectQcIssues(projectID, "")
	if err := writeQcCSV(zw, qcIssues); err != nil {
		return "", err
	}

	if err := writeJSON(zw, "render-metadata.json", map[string]any{
		"exported_at": time.Now().UTC().Format(time.RFC3339),
		"takes":       renderItems,
	}); err != nil {
		return "", err
	}

	if fw, err := zw.Create("README.txt"); err == nil {
		_, _ = fw.Write([]byte(buildReadme(project.Title, audioIndex-1)))
	}

	if err := zw.Close(); err != nil {
		return "", fmt.Errorf("close zip: %w", err)
	}

	outPath := filepath.Join(cfg.ExportCacheDir, fmt.Sprintf("%d.zip", jobID))
	if err := os.WriteFile(outPath, buf.Bytes(), 0o600); err != nil {
		return "", fmt.Errorf("write zip: %w", err)
	}
	return outPath, nil
}

// encodePCM16MonoWAV wraps raw 16-bit mono PCM bytes in a RIFF/WAV header.
func encodePCM16MonoWAV(pcm []byte, sampleRate int) []byte {
	const channels = 1
	const bitsPerSample = 16
	byteRate := sampleRate * channels * bitsPerSample / 8
	blockAlign := channels * bitsPerSample / 8
	dataSize := len(pcm)

	var hdr [44]byte
	copy(hdr[0:4], "RIFF")
	binary.LittleEndian.PutUint32(hdr[4:8], uint32(36+dataSize))
	copy(hdr[8:12], "WAVE")
	copy(hdr[12:16], "fmt ")
	binary.LittleEndian.PutUint32(hdr[16:20], 16)
	binary.LittleEndian.PutUint16(hdr[20:22], 1) // PCM
	binary.LittleEndian.PutUint16(hdr[22:24], uint16(channels))
	binary.LittleEndian.PutUint32(hdr[24:28], uint32(sampleRate))
	binary.LittleEndian.PutUint32(hdr[28:32], uint32(byteRate))
	binary.LittleEndian.PutUint16(hdr[32:34], uint16(blockAlign))
	binary.LittleEndian.PutUint16(hdr[34:36], uint16(bitsPerSample))
	copy(hdr[36:40], "data")
	binary.LittleEndian.PutUint32(hdr[40:44], uint32(dataSize))

	out := make([]byte, 44+dataSize)
	copy(out, hdr[:])
	copy(out[44:], pcm)
	return out
}

var unsafeChars = regexp.MustCompile(`[^a-zA-Z0-9_-]`)

func sanitizeFilename(name string) string {
	s := strings.ToLower(strings.TrimSpace(name))
	s = unsafeChars.ReplaceAllString(s, "_")
	if len(s) > 32 {
		s = s[:32]
	}
	if s == "" {
		s = "voice"
	}
	return s
}

func derefStr(p *string) string {
	if p == nil {
		return ""
	}
	return *p
}

func writeJSON(zw *zip.Writer, name string, v any) error {
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal %s: %w", name, err)
	}
	fw, err := zw.Create(name)
	if err != nil {
		return fmt.Errorf("create zip entry %s: %w", name, err)
	}
	_, err = fw.Write(data)
	return err
}

func writeQcCSV(zw *zip.Writer, issues []store.QcIssue) error {
	fw, err := zw.Create("qc-notes.csv")
	if err != nil {
		return fmt.Errorf("create qc-notes.csv: %w", err)
	}
	w := csv.NewWriter(fw)
	_ = w.Write([]string{"id", "segment_id", "take_id", "issue_type", "severity", "status", "note", "created_at"})
	for _, issue := range issues {
		takeIDStr := ""
		if issue.TakeID != nil {
			takeIDStr = fmt.Sprintf("%d", *issue.TakeID)
		}
		_ = w.Write([]string{
			fmt.Sprintf("%d", issue.ID),
			fmt.Sprintf("%d", issue.SegmentID),
			takeIDStr,
			issue.IssueType,
			issue.Severity,
			issue.Status,
			issue.Note,
			issue.CreatedAt,
		})
	}
	w.Flush()
	return w.Error()
}

func buildReadme(projectTitle string, audioCount int) string {
	return fmt.Sprintf(`Project: %s
Exported: %s
Audio files: %d WAV file(s) in audio/

Contents
--------
audio/                         - One WAV per rendered segment (24 kHz, 16-bit, mono)
project.json                   - Project structure with section, segment, and take refs
cast-bible.json                - Cast profile definitions
pronunciation-dictionary.json  - Enabled pronunciation rules
qc-notes.csv                   - QC issues and annotations
render-metadata.json           - Render provenance (voice, model, prompt hash, etc.)
README.txt                     - This file

Audio files contain the best approved take for each segment.
If no approved take exists, the latest rendered take is used.
Segments without a take are not included in audio/.
`, projectTitle, time.Now().UTC().Format("2006-01-02 15:04:05 UTC"), audioCount)
}
