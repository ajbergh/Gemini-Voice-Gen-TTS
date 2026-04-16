// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_history.go implements HTTP handlers for browsing,
// retrieving, and deleting TTS generation history at /api/history.
package handler

import (
	"encoding/base64"
	"net/http"
	"os"
	"strconv"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// HistoryHandler handles /api/history endpoints.
type HistoryHandler struct {
	Store *store.Store
}

// ListHistory returns history entries with optional type filter and pagination.
func (h *HistoryHandler) ListHistory(w http.ResponseWriter, r *http.Request) {
	historyType := r.URL.Query().Get("type")

	limit := 50
	if l := r.URL.Query().Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	offset := 0
	if o := r.URL.Query().Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	entries, err := h.Store.ListHistory(historyType, limit, offset)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list history")
		return
	}
	if entries == nil {
		entries = []store.HistoryEntry{}
	}
	writeJSON(w, http.StatusOK, entries)
}

// GetHistoryEntry returns a single history entry by ID.
func (h *HistoryHandler) GetHistoryEntry(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid history id")
		return
	}

	entry, err := h.Store.GetHistoryEntry(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "history entry not found")
		return
	}

	writeJSON(w, http.StatusOK, entry)
}

// DeleteHistoryEntry removes a single history entry.
func (h *HistoryHandler) DeleteHistoryEntry(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid history id")
		return
	}

	if err := h.Store.DeleteHistoryEntry(id); err != nil {
		writeError(w, http.StatusNotFound, "history entry not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ClearHistory removes all history entries.
func (h *HistoryHandler) ClearHistory(w http.ResponseWriter, r *http.Request) {
	if err := h.Store.ClearHistory(); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to clear history")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "cleared"})
}

// GetHistoryAudio returns cached audio for a history entry as base64.
func (h *HistoryHandler) GetHistoryAudio(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid history id")
		return
	}

	entry, err := h.Store.GetHistoryEntry(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "history entry not found")
		return
	}

	if entry.AudioPath == nil || *entry.AudioPath == "" {
		writeError(w, http.StatusNotFound, "no cached audio for this entry")
		return
	}

	data, err := os.ReadFile(*entry.AudioPath)
	if err != nil {
		writeError(w, http.StatusNotFound, "cached audio file not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"audioBase64": base64.StdEncoding.EncodeToString(data),
	})
}
