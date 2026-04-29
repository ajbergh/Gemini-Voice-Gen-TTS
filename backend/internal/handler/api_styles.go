// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_styles.go implements performance style preset APIs.
package handler

import (
	"database/sql"
	"net/http"
	"strconv"
	"strings"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// StylesHandler handles performance style preset endpoints.
type StylesHandler struct {
	Store *store.Store
}

// ListStyles returns all global styles plus project-scoped styles.
//
// GET /api/styles?project_id={id}
func (h *StylesHandler) ListStyles(w http.ResponseWriter, r *http.Request) {
	var projectID int64
	if pidStr := r.URL.Query().Get("project_id"); pidStr != "" {
		pid, err := strconv.ParseInt(pidStr, 10, 64)
		if err != nil {
			writeError(w, http.StatusBadRequest, "invalid project_id")
			return
		}
		projectID = pid
	}

	styles, err := h.Store.ListStyles(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list styles")
		return
	}
	writeJSON(w, http.StatusOK, styles)
}

// CreateStyle creates a new user-defined style.
//
// POST /api/styles
func (h *StylesHandler) CreateStyle(w http.ResponseWriter, r *http.Request) {
	var req store.PerformanceStyle
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if req.Scope == "" {
		req.Scope = "global"
	}

	id, err := h.Store.CreateStyle(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create style")
		return
	}
	style, err := h.Store.GetStyle(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read created style")
		return
	}
	writeJSON(w, http.StatusCreated, style)
}

// GetStyle returns a single style by ID.
//
// GET /api/styles/{id}
func (h *StylesHandler) GetStyle(w http.ResponseWriter, r *http.Request) {
	style, ok := h.requireStyle(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, style)
}

// UpdateStyle updates a style and snapshots its previous state.
//
// PUT /api/styles/{id}
func (h *StylesHandler) UpdateStyle(w http.ResponseWriter, r *http.Request) {
	styleID, ok := parsePathInt64(w, r, "id", "invalid style ID")
	if !ok {
		return
	}
	var req store.PerformanceStyle
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	updated, err := h.Store.UpdateStyle(styleID, req)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "style not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to update style")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// DeleteStyle removes a user-created style. Builtin styles are rejected.
//
// DELETE /api/styles/{id}
func (h *StylesHandler) DeleteStyle(w http.ResponseWriter, r *http.Request) {
	styleID, ok := parsePathInt64(w, r, "id", "invalid style ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteStyle(styleID); err != nil {
		if strings.Contains(err.Error(), "built-in") || strings.Contains(err.Error(), "not found") {
			writeError(w, http.StatusBadRequest, err.Error())
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete style")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ListStyleVersions returns snapshot history for a style.
//
// GET /api/styles/{id}/versions
func (h *StylesHandler) ListStyleVersions(w http.ResponseWriter, r *http.Request) {
	style, ok := h.requireStyle(w, r)
	if !ok {
		return
	}
	versions, err := h.Store.ListStyleVersions(style.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list style versions")
		return
	}
	writeJSON(w, http.StatusOK, versions)
}

// RevertStyleVersion restores a style to a previous version.
//
// POST /api/styles/{id}/versions/{versionId}/revert
func (h *StylesHandler) RevertStyleVersion(w http.ResponseWriter, r *http.Request) {
	style, ok := h.requireStyle(w, r)
	if !ok {
		return
	}
	versionID, ok := parsePathInt64(w, r, "versionId", "invalid version ID")
	if !ok {
		return
	}
	reverted, err := h.Store.RevertStyleVersion(style.ID, versionID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "style version not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to revert style version")
		return
	}
	writeJSON(w, http.StatusOK, reverted)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func (h *StylesHandler) requireStyle(w http.ResponseWriter, r *http.Request) (*store.PerformanceStyle, bool) {
	styleID, ok := parsePathInt64(w, r, "id", "invalid style ID")
	if !ok {
		return nil, false
	}
	style, err := h.Store.GetStyle(styleID)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "style not found")
			return nil, false
		}
		writeError(w, http.StatusInternalServerError, "failed to get style")
		return nil, false
	}
	return style, true
}
