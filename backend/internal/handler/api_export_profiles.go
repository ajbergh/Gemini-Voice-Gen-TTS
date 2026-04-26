// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_export_profiles.go implements CRUD endpoints for
// named audio finishing/export profiles.
package handler

import (
	"net/http"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// ExportProfilesHandler handles /api/export-profiles endpoints.
type ExportProfilesHandler struct {
	Store *store.Store
}

// ListExportProfiles returns all export profiles (builtins first).
func (h *ExportProfilesHandler) ListExportProfiles(w http.ResponseWriter, r *http.Request) {
	profiles, err := h.Store.ListExportProfiles()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list export profiles")
		return
	}
	if profiles == nil {
		profiles = []store.ExportProfile{}
	}
	writeJSON(w, http.StatusOK, profiles)
}

// GetExportProfile returns a single export profile by ID.
func (h *ExportProfilesHandler) GetExportProfile(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePathInt64(w, r, "id", "invalid export profile ID")
	if !ok {
		return
	}
	profile, err := h.Store.GetExportProfile(id)
	if err != nil {
		writeStoreError(w, err, "export profile not found", "failed to get export profile")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

// CreateExportProfile inserts a new custom export profile.
func (h *ExportProfilesHandler) CreateExportProfile(w http.ResponseWriter, r *http.Request) {
	var req store.ExportProfile
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	id, err := h.Store.CreateExportProfile(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create export profile")
		return
	}
	profile, err := h.Store.GetExportProfile(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read created export profile")
		return
	}
	writeJSON(w, http.StatusCreated, profile)
}

// UpdateExportProfile replaces a custom profile's fields.
func (h *ExportProfilesHandler) UpdateExportProfile(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePathInt64(w, r, "id", "invalid export profile ID")
	if !ok {
		return
	}
	var req store.ExportProfile
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.ID = id
	if err := h.Store.UpdateExportProfile(req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	profile, err := h.Store.GetExportProfile(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read updated export profile")
		return
	}
	writeJSON(w, http.StatusOK, profile)
}

// DeleteExportProfile removes a custom (non-builtin) profile.
func (h *ExportProfilesHandler) DeleteExportProfile(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePathInt64(w, r, "id", "invalid export profile ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteExportProfile(id); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}
