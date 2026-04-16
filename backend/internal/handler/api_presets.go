// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_presets.go implements HTTP handlers for custom voice
// preset CRUD and cached audio retrieval at /api/presets.
package handler

import (
	"encoding/base64"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// PresetsHandler handles /api/presets endpoints.
type PresetsHandler struct {
	Store         *store.Store
	AudioCacheDir string
}

// presetWithTags wraps a preset with its tags for JSON responses.
type presetWithTags struct {
	store.CustomPreset
	Tags []store.PresetTag `json:"tags"`
}

func (h *PresetsHandler) enrichWithTags(p store.CustomPreset) presetWithTags {
	tags, err := h.Store.ListTagsForPreset(p.ID)
	if err != nil {
		tags = nil
	}
	if tags == nil {
		tags = []store.PresetTag{}
	}
	return presetWithTags{CustomPreset: p, Tags: tags}
}

// ListPresets returns all custom presets.
func (h *PresetsHandler) ListPresets(w http.ResponseWriter, r *http.Request) {
	presets, err := h.Store.ListCustomPresets()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list presets")
		return
	}
	if presets == nil {
		presets = []store.CustomPreset{}
	}
	result := make([]presetWithTags, len(presets))
	for i, p := range presets {
		result[i] = h.enrichWithTags(p)
	}
	writeJSON(w, http.StatusOK, result)
}

// GetPreset returns a single custom preset by ID.
func (h *PresetsHandler) GetPreset(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid preset ID")
		return
	}

	preset, err := h.Store.GetCustomPreset(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "preset not found")
		return
	}
	writeJSON(w, http.StatusOK, h.enrichWithTags(*preset))
}

// CreatePreset creates a new custom preset, optionally caching audio.
func (h *PresetsHandler) CreatePreset(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name              string  `json:"name"`
		VoiceName         string  `json:"voice_name"`
		SystemInstruction *string `json:"system_instruction"`
		SampleText        *string `json:"sample_text"`
		AudioBase64       *string `json:"audio_base64"`
		SourceQuery       *string `json:"source_query"`
		MetadataJSON      *string `json:"metadata_json"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.Name == "" || req.VoiceName == "" {
		writeError(w, http.StatusBadRequest, "name and voice_name are required")
		return
	}

	preset := store.CustomPreset{
		Name:              req.Name,
		VoiceName:         req.VoiceName,
		SystemInstruction: req.SystemInstruction,
		SampleText:        req.SampleText,
		SourceQuery:       req.SourceQuery,
		MetadataJSON:      req.MetadataJSON,
	}

	// Cache audio to disk if provided
	if req.AudioBase64 != nil && *req.AudioBase64 != "" && h.AudioCacheDir != "" {
		audioBytes, err := base64.StdEncoding.DecodeString(*req.AudioBase64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid audio_base64 encoding")
			return
		}
		safeName := sanitizeForFilename(req.VoiceName)
		filename := fmt.Sprintf("preset_%d_%s.raw", time.Now().UnixMilli(), safeName)
		cachePath, ok := safeCachePath(h.AudioCacheDir, filename)
		if !ok {
			writeError(w, http.StatusBadRequest, "invalid voice name for file path")
			return
		}
		if err := os.WriteFile(cachePath, audioBytes, 0o600); err != nil {
			slog.Warn("failed to cache preset audio", "error", err)
		} else {
			preset.AudioPath = &cachePath
		}
	}

	id, err := h.Store.InsertCustomPreset(preset)
	if err != nil {
		writeError(w, http.StatusConflict, "failed to create preset: "+err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

// UpdatePreset updates mutable fields of a custom preset.
func (h *PresetsHandler) UpdatePreset(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid preset ID")
		return
	}

	var req struct {
		Name         *string `json:"name"`
		SampleText   *string `json:"sample_text"`
		AudioBase64  *string `json:"audio_base64"`
		MetadataJSON *string `json:"metadata_json"`
		Color        *string `json:"color"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	existing, err := h.Store.GetCustomPreset(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "preset not found")
		return
	}

	updated := *existing
	if req.Name != nil {
		updated.Name = *req.Name
	}
	if req.SampleText != nil {
		updated.SampleText = req.SampleText
	}
	if req.MetadataJSON != nil {
		updated.MetadataJSON = req.MetadataJSON
	}
	if req.Color != nil {
		updated.Color = *req.Color
	}

	// Cache new audio if provided
	if req.AudioBase64 != nil && *req.AudioBase64 != "" && h.AudioCacheDir != "" {
		audioBytes, decErr := base64.StdEncoding.DecodeString(*req.AudioBase64)
		if decErr == nil {
			safeName := sanitizeForFilename(existing.VoiceName)
			filename := fmt.Sprintf("preset_%d_%s.raw", time.Now().UnixMilli(), safeName)
			cachePath, ok := safeCachePath(h.AudioCacheDir, filename)
			if !ok {
				writeError(w, http.StatusBadRequest, "invalid voice name for file path")
				return
			}
			if writeErr := os.WriteFile(cachePath, audioBytes, 0o600); writeErr == nil {
				// Remove old audio file if it exists
				if existing.AudioPath != nil {
					os.Remove(*existing.AudioPath)
				}
				updated.AudioPath = &cachePath
			}
		}
	}

	if err := h.Store.UpdateCustomPreset(id, updated); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update preset")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeletePreset removes a custom preset and its cached audio file.
func (h *PresetsHandler) DeletePreset(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid preset ID")
		return
	}

	// Get preset to find audio path before deletion
	preset, err := h.Store.GetCustomPreset(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "preset not found")
		return
	}

	if err := h.Store.DeleteCustomPreset(id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete preset")
		return
	}

	// Remove cached audio file
	if preset.AudioPath != nil {
		if removeErr := os.Remove(*preset.AudioPath); removeErr != nil && !os.IsNotExist(removeErr) {
			slog.Warn("failed to remove preset audio file", "path", *preset.AudioPath, "error", removeErr)
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// GetPresetAudio returns cached audio for a preset as base64 PCM.
func (h *PresetsHandler) GetPresetAudio(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid preset ID")
		return
	}

	preset, err := h.Store.GetCustomPreset(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "preset not found")
		return
	}

	if preset.AudioPath == nil || *preset.AudioPath == "" {
		writeError(w, http.StatusNotFound, "no audio cached for this preset")
		return
	}

	audioBytes, err := os.ReadFile(*preset.AudioPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "audio file not found on disk")
		return
	}

	audioBase64 := base64.StdEncoding.EncodeToString(audioBytes)
	writeJSON(w, http.StatusOK, map[string]string{"audioBase64": audioBase64})
}

// ListAllTags returns all distinct tags across all presets.
func (h *PresetsHandler) ListAllTags(w http.ResponseWriter, r *http.Request) {
	tags, err := h.Store.ListAllTags()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list tags")
		return
	}
	if tags == nil {
		tags = []store.PresetTag{}
	}
	writeJSON(w, http.StatusOK, tags)
}

// SetPresetTags replaces all tags for a given preset.
func (h *PresetsHandler) SetPresetTags(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid preset ID")
		return
	}

	var req struct {
		Tags []struct {
			Tag   string `json:"tag"`
			Color string `json:"color"`
		} `json:"tags"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	tags := make([]store.PresetTag, len(req.Tags))
	for i, t := range req.Tags {
		tags[i] = store.PresetTag{PresetID: id, Tag: t.Tag, Color: t.Color}
	}

	if err := h.Store.SetPresetTags(id, tags); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to set tags")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// exportPreset is the JSON schema for preset import/export.
type exportPreset struct {
	Name              string      `json:"name"`
	VoiceName         string      `json:"voice_name"`
	SystemInstruction *string     `json:"system_instruction,omitempty"`
	SampleText        *string     `json:"sample_text,omitempty"`
	SourceQuery       *string     `json:"source_query,omitempty"`
	MetadataJSON      *string     `json:"metadata_json,omitempty"`
	Tags              []exportTag `json:"tags"`
}

type exportTag struct {
	Tag   string `json:"tag"`
	Color string `json:"color"`
}

// ExportPresets returns all presets with tags as a downloadable JSON array.
func (h *PresetsHandler) ExportPresets(w http.ResponseWriter, r *http.Request) {
	presets, err := h.Store.ListCustomPresets()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list presets")
		return
	}

	var result []exportPreset
	for _, p := range presets {
		tags, _ := h.Store.ListTagsForPreset(p.ID)
		ep := exportPreset{
			Name:              p.Name,
			VoiceName:         p.VoiceName,
			SystemInstruction: p.SystemInstruction,
			SampleText:        p.SampleText,
			SourceQuery:       p.SourceQuery,
			MetadataJSON:      p.MetadataJSON,
		}
		for _, t := range tags {
			ep.Tags = append(ep.Tags, exportTag{Tag: t.Tag, Color: t.Color})
		}
		if ep.Tags == nil {
			ep.Tags = []exportTag{}
		}
		result = append(result, ep)
	}
	if result == nil {
		result = []exportPreset{}
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", `attachment; filename="voice-presets.json"`)
	writeJSON(w, http.StatusOK, result)
}

// ImportPresets creates presets from a JSON array, skipping duplicates.
func (h *PresetsHandler) ImportPresets(w http.ResponseWriter, r *http.Request) {
	var imports []exportPreset
	if err := decodeJSON(r, &imports); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if len(imports) == 0 {
		writeError(w, http.StatusBadRequest, "no presets to import")
		return
	}

	if len(imports) > 100 {
		writeError(w, http.StatusBadRequest, "too many presets (max 100)")
		return
	}

	var imported, skipped int
	for _, ep := range imports {
		if ep.Name == "" || ep.VoiceName == "" {
			skipped++
			continue
		}

		preset := store.CustomPreset{
			Name:              ep.Name,
			VoiceName:         ep.VoiceName,
			SystemInstruction: ep.SystemInstruction,
			SampleText:        ep.SampleText,
			SourceQuery:       ep.SourceQuery,
			MetadataJSON:      ep.MetadataJSON,
		}

		id, err := h.Store.InsertCustomPreset(preset)
		if err != nil {
			skipped++
			continue
		}

		if len(ep.Tags) > 0 {
			tags := make([]store.PresetTag, len(ep.Tags))
			for i, t := range ep.Tags {
				tags[i] = store.PresetTag{PresetID: id, Tag: t.Tag, Color: t.Color}
			}
			_ = h.Store.SetPresetTags(id, tags)
		}
		imported++
	}

	writeJSON(w, http.StatusOK, map[string]int{"imported": imported, "skipped": skipped})
}

// ReorderPresets updates the sort order for presets based on an ordered list of IDs.
func (h *PresetsHandler) ReorderPresets(w http.ResponseWriter, r *http.Request) {
	var req struct {
		OrderedIDs []int64 `json:"ordered_ids"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if len(req.OrderedIDs) == 0 {
		writeError(w, http.StatusBadRequest, "ordered_ids is required")
		return
	}
	if len(req.OrderedIDs) > 500 {
		writeError(w, http.StatusBadRequest, "too many IDs (max 500)")
		return
	}

	if err := h.Store.ReorderPresets(req.OrderedIDs); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to reorder presets")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "reordered"})
}

// ListPresetVersions returns version history for a preset.
func (h *PresetsHandler) ListPresetVersions(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid preset id")
		return
	}

	versions, err := h.Store.ListPresetVersions(id, 20)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list versions")
		return
	}
	if versions == nil {
		versions = []store.PresetVersion{}
	}
	writeJSON(w, http.StatusOK, versions)
}

// RevertPresetVersion restores a preset to a previous version.
func (h *PresetsHandler) RevertPresetVersion(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid preset id")
		return
	}

	versionStr := r.PathValue("versionId")
	versionID, err := strconv.ParseInt(versionStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid version id")
		return
	}

	if err := h.Store.RevertPresetVersion(id, versionID); err != nil {
		writeError(w, http.StatusNotFound, "version not found")
		return
	}

	preset, err := h.Store.GetCustomPreset(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get updated preset")
		return
	}
	writeJSON(w, http.StatusOK, h.enrichWithTags(*preset))
}
