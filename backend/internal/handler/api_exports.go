// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_exports.go implements deliverable packaging export
// job management endpoints (Plan 11).
package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strconv"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/exporter"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// ExportsHandler manages export job lifecycle.
type ExportsHandler struct {
	Store          *store.Store
	AudioCacheDir  string
	ExportCacheDir string
}

type startExportRequest struct {
	ExportProfileID *int64 `json:"export_profile_id,omitempty"`
}

// StartExport handles POST /api/projects/{id}/exports.
// Creates an export job and starts the packaging goroutine.
// Returns 202 Accepted with the job record.
func (h *ExportsHandler) StartExport(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid project id", http.StatusBadRequest)
		return
	}

	var req startExportRequest
	if r.ContentLength > 0 {
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid request body", http.StatusBadRequest)
			return
		}
	}

	jobID, err := h.Store.CreateExportJob(projectID, req.ExportProfileID)
	if err != nil {
		slog.Error("create export job", "error", err)
		http.Error(w, "failed to create export job", http.StatusInternalServerError)
		return
	}

	go exporter.Run(context.Background(), exporter.Config{
		Store:          h.Store,
		AudioCacheDir:  h.AudioCacheDir,
		ExportCacheDir: h.ExportCacheDir,
	}, jobID, projectID)

	job, _ := h.Store.GetExportJob(jobID)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusAccepted)
	_ = json.NewEncoder(w).Encode(job)
}

// GetExport handles GET /api/exports/{exportId}.
func (h *ExportsHandler) GetExport(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("exportId"), 10, 64)
	if err != nil {
		http.Error(w, "invalid export id", http.StatusBadRequest)
		return
	}
	job, err := h.Store.GetExportJob(id)
	if err != nil {
		http.Error(w, "store error", http.StatusInternalServerError)
		return
	}
	if job == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(job)
}

// ListExports handles GET /api/projects/{id}/exports.
func (h *ExportsHandler) ListExports(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid project id", http.StatusBadRequest)
		return
	}
	jobs, err := h.Store.ListExportJobs(projectID)
	if err != nil {
		http.Error(w, "store error", http.StatusInternalServerError)
		return
	}
	if jobs == nil {
		jobs = []store.ExportJob{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(jobs)
}

// DownloadExport handles GET /api/exports/{exportId}/download.
// Streams the ZIP archive when the job is complete.
func (h *ExportsHandler) DownloadExport(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("exportId"), 10, 64)
	if err != nil {
		http.Error(w, "invalid export id", http.StatusBadRequest)
		return
	}
	job, err := h.Store.GetExportJob(id)
	if err != nil || job == nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	if job.Status != "complete" {
		http.Error(w, fmt.Sprintf("export job status: %s", job.Status), http.StatusConflict)
		return
	}
	if job.OutputPath == nil {
		http.Error(w, "output path not set", http.StatusInternalServerError)
		return
	}
	f, err := os.Open(*job.OutputPath)
	if err != nil {
		http.Error(w, "zip file not found", http.StatusNotFound)
		return
	}
	defer f.Close()

	fname := filepath.Base(*job.OutputPath)
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, fname))
	_, _ = io.Copy(w, f)
}
