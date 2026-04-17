// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_history.go implements HTTP handlers for browsing,
// retrieving, and deleting TTS generation history at /api/history.
package handler

import (
	"encoding/base64"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// HistoryHandler handles /api/history endpoints.
type HistoryHandler struct {
	Store         *store.Store
	AudioCacheDir string
}

// ListHistory returns history entries with optional filters and pagination.
func (h *HistoryHandler) ListHistory(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	limit := 50
	if l := q.Get("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil && parsed > 0 && parsed <= 200 {
			limit = parsed
		}
	}

	offset := 0
	if o := q.Get("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil && parsed >= 0 {
			offset = parsed
		}
	}

	filter := store.HistoryFilter{
		Type:     q.Get("type"),
		Query:    q.Get("q"),
		Voice:    q.Get("voice"),
		DateFrom: q.Get("from"),
		DateTo:   q.Get("to"),
		Limit:    limit,
		Offset:   offset,
	}

	entries, err := h.Store.ListHistory(filter)
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

	data, err := readCachedAudioFile(h.AudioCacheDir, *entry.AudioPath)
	if err != nil {
		slog.Warn("rejected history audio path", "history_id", id, "path", *entry.AudioPath, "error", err)
		writeError(w, http.StatusNotFound, "cached audio file not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"audioBase64": base64.StdEncoding.EncodeToString(data),
	})
}

// ExportHistory exports all history entries as CSV or JSON.
func (h *HistoryHandler) ExportHistory(w http.ResponseWriter, r *http.Request) {
	format := r.URL.Query().Get("format")
	if format != "csv" && format != "json" {
		format = "json"
	}

	entries, err := h.Store.ListHistory(store.HistoryFilter{Limit: 10000, Offset: 0})
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to export history")
		return
	}
	if entries == nil {
		entries = []store.HistoryEntry{}
	}

	if format == "csv" {
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", "attachment; filename=history.csv")

		writer := csv.NewWriter(w)
		_ = writer.Write([]string{"id", "type", "voice_name", "input_text", "created_at"})
		for _, e := range entries {
			voice := ""
			if e.VoiceName != nil {
				voice = *e.VoiceName
			}
			_ = writer.Write([]string{
				fmt.Sprintf("%d", e.ID),
				e.Type,
				voice,
				e.InputText,
				e.CreatedAt,
			})
		}
		writer.Flush()
		return
	}

	// JSON export
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=history.json")
	_ = json.NewEncoder(w).Encode(entries)
}
