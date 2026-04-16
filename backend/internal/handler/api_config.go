// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_config.go implements HTTP handlers for reading and
// updating application configuration at /api/config.
package handler

import (
	"net/http"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// ConfigHandler handles /api/config endpoints.
type ConfigHandler struct {
	Store *store.Store
}

// GetConfig returns all config key-value pairs.
func (h *ConfigHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	entries, err := h.Store.GetAllConfig()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read config")
		return
	}

	// Convert to a flat map for the frontend
	result := make(map[string]string, len(entries))
	for _, e := range entries {
		result[e.Key] = e.Value
	}
	writeJSON(w, http.StatusOK, result)
}

// UpdateConfig upserts config entries from a JSON body.
func (h *ConfigHandler) UpdateConfig(w http.ResponseWriter, r *http.Request) {
	var body map[string]string
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if len(body) == 0 {
		writeError(w, http.StatusBadRequest, "empty config body")
		return
	}

	if err := h.Store.SetConfigBatch(body); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update config")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}
