// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_cast.go implements project cast bible APIs.
package handler

import (
	"net/http"
	"strings"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/gemini"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// CastHandler handles project cast profile endpoints.
type CastHandler struct {
	Store       *store.Store
	KeysHandler *KeysHandler
}

// ListProjectCast returns all cast profiles for a project.
func (h *CastHandler) ListProjectCast(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	profiles, err := h.Store.ListCastProfiles(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list cast profiles")
		return
	}
	if profiles == nil {
		profiles = []store.CastProfile{}
	}
	writeJSON(w, http.StatusOK, profiles)
}

// CreateProjectCast creates a cast profile scoped to a project.
func (h *CastHandler) CreateProjectCast(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	var req store.CastProfile
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	id, err := h.Store.CreateCastProfile(projectID, req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create cast profile")
		return
	}
	profile, err := h.Store.GetCastProfile(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read created cast profile")
		return
	}
	writeJSON(w, http.StatusCreated, profile)
}

// GetCastProfile returns a single cast profile.
func (h *CastHandler) GetCastProfile(w http.ResponseWriter, r *http.Request) {
	profile, ok := h.requireCastProfile(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

// UpdateCastProfile updates a cast profile and snapshots its previous state.
func (h *CastHandler) UpdateCastProfile(w http.ResponseWriter, r *http.Request) {
	profileID, ok := parsePathInt64(w, r, "profileId", "invalid cast profile ID")
	if !ok {
		return
	}
	var req store.CastProfile
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.Store.UpdateCastProfile(profileID, req); err != nil {
		writeStoreError(w, err, "cast profile not found", "failed to update cast profile")
		return
	}
	profile, err := h.Store.GetCastProfile(profileID)
	if err != nil {
		writeStoreError(w, err, "cast profile not found", "failed to read updated cast profile")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

// DeleteCastProfile deletes a cast profile.
func (h *CastHandler) DeleteCastProfile(w http.ResponseWriter, r *http.Request) {
	profileID, ok := parsePathInt64(w, r, "profileId", "invalid cast profile ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteCastProfile(profileID); err != nil {
		writeStoreError(w, err, "cast profile not found", "failed to delete cast profile")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ListCastProfileVersions returns snapshot history for a cast profile.
func (h *CastHandler) ListCastProfileVersions(w http.ResponseWriter, r *http.Request) {
	profile, ok := h.requireCastProfile(w, r)
	if !ok {
		return
	}
	versions, err := h.Store.ListCastProfileVersions(profile.ID, 20)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list cast profile versions")
		return
	}
	if versions == nil {
		versions = []store.CastProfileVersion{}
	}
	writeJSON(w, http.StatusOK, versions)
}

// RevertCastProfileVersion restores a cast profile snapshot.
func (h *CastHandler) RevertCastProfileVersion(w http.ResponseWriter, r *http.Request) {
	profile, ok := h.requireCastProfile(w, r)
	if !ok {
		return
	}
	versionID, ok := parsePathInt64(w, r, "versionId", "invalid cast profile version ID")
	if !ok {
		return
	}
	if err := h.Store.RevertCastProfileVersion(profile.ID, versionID); err != nil {
		writeStoreError(w, err, "cast profile version not found", "failed to revert cast profile")
		return
	}
	updated, err := h.Store.GetCastProfile(profile.ID)
	if err != nil {
		writeStoreError(w, err, "cast profile not found", "failed to read reverted cast profile")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// AuditionCastProfile generates a short TTS audition for a cast profile.
func (h *CastHandler) AuditionCastProfile(w http.ResponseWriter, r *http.Request) {
	profile, ok := h.requireCastProfile(w, r)
	if !ok {
		return
	}
	var req struct {
		SampleText string `json:"sample_text"`
		VoiceName  string `json:"voice_name"`
		PresetID   *int64 `json:"preset_id"`
		StyleID    *int64 `json:"style_id"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	sampleText := strings.TrimSpace(req.SampleText)
	if sampleText == "" {
		writeError(w, http.StatusBadRequest, "sample_text is required")
		return
	}

	voiceName := strings.TrimSpace(req.VoiceName)
	if voiceName == "" {
		voiceName = derefStr(profile.VoiceName)
	}

	var systemInstruction string
	presetID := req.PresetID
	if presetID == nil {
		presetID = profile.PresetID
	}
	if presetID != nil {
		if preset, err := h.Store.GetCustomPreset(*presetID); err == nil {
			if voiceName == "" {
				voiceName = preset.VoiceName
			}
			systemInstruction = derefStr(preset.SystemInstruction)
		}
	}
	if voiceName == "" {
		writeError(w, http.StatusUnprocessableEntity, "cast profile has no voice configured")
		return
	}
	if h.KeysHandler == nil {
		writeError(w, http.StatusInternalServerError, "keys handler is not configured")
		return
	}
	apiKey, err := h.KeysHandler.GetDecryptedKey("gemini")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Gemini API key is not configured")
		return
	}

	client := gemini.NewClient(apiKey)
	audioBase64, err := client.GenerateTTS(sampleText, voiceName, systemInstruction, derefStr(profile.LanguageCode), "")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to generate cast audition")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"profile_id":    profile.ID,
		"voice_name":    voiceName,
		"audioBase64":   audioBase64,
		"sample_text":   sampleText,
		"style_id":      req.StyleID,
		"preset_id":     presetID,
		"language_code": derefStr(profile.LanguageCode),
	})
}

// requireProject validates the path project ID before cast operations.
func (h *CastHandler) requireProject(w http.ResponseWriter, r *http.Request) (int64, bool) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return 0, false
	}
	if _, err := h.Store.GetProject(projectID); err != nil {
		writeStoreError(w, err, "project not found", "failed to get project")
		return 0, false
	}
	return projectID, true
}

// requireCastProfile validates the path profile ID and loads the cast profile.
func (h *CastHandler) requireCastProfile(w http.ResponseWriter, r *http.Request) (*store.CastProfile, bool) {
	profileID, ok := parsePathInt64(w, r, "profileId", "invalid cast profile ID")
	if !ok {
		return nil, false
	}
	profile, err := h.Store.GetCastProfile(profileID)
	if err != nil {
		writeStoreError(w, err, "cast profile not found", "failed to get cast profile")
		return nil, false
	}
	return profile, true
}
