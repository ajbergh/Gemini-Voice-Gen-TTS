// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_takes.go implements HTTP handlers for segment audio
// takes and reviewer notes.
package handler

import (
	"database/sql"
	"encoding/base64"
	"errors"
	"net/http"
	"strings"

	"log/slog"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// TakesHandler handles /api/projects/{id}/segments/{segmentId}/takes endpoints.
type TakesHandler struct {
	Store         *store.Store
	AudioCacheDir string
}

// requireProjectAndSegment parses path values and verifies the segment belongs
// to the project.
func (h *TakesHandler) requireProjectAndSegment(w http.ResponseWriter, r *http.Request) (int64, int64, bool) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return 0, 0, false
	}
	segmentID, ok := parsePathInt64(w, r, "segmentId", "invalid segment ID")
	if !ok {
		return 0, 0, false
	}
	if _, err := h.Store.GetProjectSegment(projectID, segmentID); err != nil {
		writeStoreError(w, err, "segment not found", "failed to get segment")
		return 0, 0, false
	}
	return projectID, segmentID, true
}

// requireTake validates project, segment, and take path values before take operations.
func (h *TakesHandler) requireTake(w http.ResponseWriter, r *http.Request) (int64, int64, *store.SegmentTake, bool) {
	projectID, segmentID, ok := h.requireProjectAndSegment(w, r)
	if !ok {
		return 0, 0, nil, false
	}
	takeID, ok := parsePathInt64(w, r, "takeId", "invalid take ID")
	if !ok {
		return 0, 0, nil, false
	}
	take, err := h.Store.GetTakeForSegment(projectID, segmentID, takeID)
	if err != nil {
		writeStoreError(w, err, "take not found", "failed to get take")
		return 0, 0, nil, false
	}
	return projectID, segmentID, take, true
}

// ListTakes returns all takes for a segment, newest first.
func (h *TakesHandler) ListTakes(w http.ResponseWriter, r *http.Request) {
	projectID, segmentID, ok := h.requireProjectAndSegment(w, r)
	if !ok {
		return
	}
	takes, err := h.Store.ListSegmentTakes(projectID, segmentID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list takes")
		return
	}
	if takes == nil {
		takes = []store.SegmentTake{}
	}
	writeJSON(w, http.StatusOK, takes)
}

// CreateTake records a new rendered take for a segment.
func (h *TakesHandler) CreateTake(w http.ResponseWriter, r *http.Request) {
	projectID, segmentID, ok := h.requireProjectAndSegment(w, r)
	if !ok {
		return
	}
	var req store.SegmentTake
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.ScriptText) == "" {
		writeError(w, http.StatusBadRequest, "script_text is required")
		return
	}
	req.ProjectID = projectID
	req.SegmentID = segmentID

	id, err := h.Store.CreateTake(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create take")
		return
	}
	take, err := h.Store.GetTake(projectID, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read created take")
		return
	}
	writeJSON(w, http.StatusCreated, take)
}

// GetTake returns a single take by ID.
func (h *TakesHandler) GetTake(w http.ResponseWriter, r *http.Request) {
	_, _, take, ok := h.requireTake(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, take)
}

// DeleteTake removes a take by ID.
func (h *TakesHandler) DeleteTake(w http.ResponseWriter, r *http.Request) {
	projectID, segmentID, take, ok := h.requireTake(w, r)
	if !ok {
		return
	}
	if err := h.Store.DeleteTakeForSegment(projectID, segmentID, take.ID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "take not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete take")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ListTakeNotes returns notes for a specific take.
func (h *TakesHandler) ListTakeNotes(w http.ResponseWriter, r *http.Request) {
	_, _, take, ok := h.requireTake(w, r)
	if !ok {
		return
	}
	notes, err := h.Store.ListTakeNotes(take.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list take notes")
		return
	}
	if notes == nil {
		notes = []store.TakeNote{}
	}
	writeJSON(w, http.StatusOK, notes)
}

// CreateTakeNote adds a reviewer note to a take.
func (h *TakesHandler) CreateTakeNote(w http.ResponseWriter, r *http.Request) {
	_, _, take, ok := h.requireTake(w, r)
	if !ok {
		return
	}
	var req struct {
		Note string `json:"note"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Note) == "" {
		writeError(w, http.StatusBadRequest, "note is required")
		return
	}
	id, err := h.Store.CreateTakeNote(take.ID, strings.TrimSpace(req.Note))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create take note")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

// DeleteTakeNote removes a specific note.
func (h *TakesHandler) DeleteTakeNote(w http.ResponseWriter, r *http.Request) {
	_, _, take, ok := h.requireTake(w, r)
	if !ok {
		return
	}
	noteID, ok := parsePathInt64(w, r, "noteId", "invalid note ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteTakeNoteForTake(take.ID, noteID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "note not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to delete note")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// GetTakeAudio returns cached PCM audio for a take as base64-encoded bytes.
func (h *TakesHandler) GetTakeAudio(w http.ResponseWriter, r *http.Request) {
	_, _, take, ok := h.requireTake(w, r)
	if !ok {
		return
	}

	if take.AudioPath == nil || *take.AudioPath == "" {
		writeError(w, http.StatusNotFound, "no cached audio for this take")
		return
	}

	data, err := readCachedAudioFile(h.AudioCacheDir, *take.AudioPath)
	if err != nil {
		slog.Warn("rejected take audio path", "take_id", take.ID, "path", *take.AudioPath, "error", err)
		writeError(w, http.StatusNotFound, "cached audio file not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"audioBase64": base64.StdEncoding.EncodeToString(data),
	})
}
