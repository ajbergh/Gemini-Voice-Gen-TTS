// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_jobs.go implements HTTP handlers for persisted job
// progress state.
package handler

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// JobsHandler handles /api/jobs endpoints.
type JobsHandler struct {
	Store *store.Store
}

// ListJobs returns recent persisted jobs for frontend reconciliation.
func (h *JobsHandler) ListJobs(w http.ResponseWriter, r *http.Request) {
	limit := 50
	if raw := r.URL.Query().Get("limit"); raw != "" {
		parsed, err := strconv.Atoi(raw)
		if err != nil || parsed < 1 {
			writeError(w, http.StatusBadRequest, "invalid limit")
			return
		}
		limit = parsed
	}

	jobs, err := h.Store.ListJobs(limit)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list jobs")
		return
	}
	if jobs == nil {
		jobs = []store.Job{}
	}
	writeJSON(w, http.StatusOK, jobs)
}

// GetJob returns a single persisted job by ID.
func (h *JobsHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		writeError(w, http.StatusBadRequest, "job ID is required")
		return
	}

	job, err := h.Store.GetJob(id)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "job not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to get job")
		return
	}
	writeJSON(w, http.StatusOK, job)
}
