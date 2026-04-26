// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_script_prep.go implements AI script preparation
// at /api/projects/{id}/prepare-script.
//
// POST /api/projects/{id}/prepare-script
//
//	Accepts a raw manuscript, submits it to Gemini, persists the result as a
//	script_prep_job, and returns the structured ScriptPrepResult JSON.
//
// GET /api/projects/{id}/prepare-script
//
//	Returns the most recent prep job for the project (result + status).
//
// POST /api/projects/{id}/script-prep/apply
//
//	Applies a reviewed prep result to the project as sections and segments.
package handler

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"strconv"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/gemini"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// ScriptPrepHandler handles AI script preparation requests.
type ScriptPrepHandler struct {
	Store       *store.Store
	KeysHandler *KeysHandler
}

// PrepareScript handles POST /api/projects/{id}/prepare-script.
func (h *ScriptPrepHandler) PrepareScript(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid project id", http.StatusBadRequest)
		return
	}

	var req struct {
		RawScript string                   `json:"raw_script"`
		Options   gemini.ScriptPrepOptions `json:"options"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.RawScript == "" {
		http.Error(w, "raw_script is required", http.StatusBadRequest)
		return
	}

	apiKey, err := h.KeysHandler.GetDecryptedKey("gemini")
	if err != nil {
		slog.Error("ScriptPrep: no active API key", "err", err)
		http.Error(w, "no active API key configured", http.StatusUnprocessableEntity)
		return
	}

	job, err := h.Store.CreateScriptPrepJob(projectID, req.RawScript)
	if err != nil {
		slog.Error("ScriptPrep: create job", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	if err := h.Store.UpdateScriptPrepJobResult(job.ID, "", "processing", ""); err != nil {
		slog.Warn("ScriptPrep: mark processing", "err", err)
	}

	client := gemini.NewClient(apiKey)
	result, geminiErr := client.PrepareScriptForNarration(req.RawScript, req.Options)

	if geminiErr != nil {
		slog.Error("ScriptPrep: Gemini error", "err", geminiErr)
		_ = h.Store.UpdateScriptPrepJobResult(job.ID, "", "failed", geminiErr.Error())
		http.Error(w, "Gemini script preparation failed: "+geminiErr.Error(), http.StatusBadGateway)
		return
	}

	resultBytes, err := json.Marshal(result)
	if err != nil {
		slog.Error("ScriptPrep: marshal result", "err", err)
		_ = h.Store.UpdateScriptPrepJobResult(job.ID, "", "failed", "marshal error")
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	resultJSON := string(resultBytes)

	if err := h.Store.UpdateScriptPrepJobResult(job.ID, resultJSON, "complete", ""); err != nil {
		slog.Error("ScriptPrep: persist result", "err", err)
	}

	updated, _ := h.Store.GetScriptPrepJob(job.ID)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(updated)
}

// GetLatestPrepResult handles GET /api/projects/{id}/prepare-script.
func (h *ScriptPrepHandler) GetLatestPrepResult(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid project id", http.StatusBadRequest)
		return
	}

	job, err := h.Store.GetLatestScriptPrepJob(projectID)
	if err != nil {
		slog.Error("ScriptPrep: get latest job", "err", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	if job == nil {
		http.Error(w, "no prep job found for this project", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(job)
}

// ApplyScriptPrep handles POST /api/projects/{id}/script-prep/apply.
func (h *ScriptPrepHandler) ApplyScriptPrep(w http.ResponseWriter, r *http.Request) {
	projectID, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "invalid project id", http.StatusBadRequest)
		return
	}
	if _, err := h.Store.GetProject(projectID); err != nil {
		http.Error(w, "project not found", http.StatusNotFound)
		return
	}

	var req struct {
		JobID                      *int64                  `json:"job_id,omitempty"`
		Result                     *store.ScriptPrepResult `json:"result,omitempty"`
		CreateCastProfiles         bool                    `json:"create_cast_profiles"`
		CreatePronunciationEntries bool                    `json:"create_pronunciation_entries"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	var result store.ScriptPrepResult
	if req.Result != nil {
		result = *req.Result
	} else if req.JobID != nil {
		job, err := h.Store.GetScriptPrepJob(*req.JobID)
		if err != nil {
			slog.Error("ScriptPrep: get apply job", "err", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if job == nil || job.ProjectID != projectID {
			http.Error(w, "prep job not found", http.StatusNotFound)
			return
		}
		if job.ResultJSON == nil || *job.ResultJSON == "" {
			http.Error(w, "prep job has no result", http.StatusConflict)
			return
		}
		if err := json.Unmarshal([]byte(*job.ResultJSON), &result); err != nil {
			http.Error(w, "prep job result is invalid", http.StatusUnprocessableEntity)
			return
		}
	} else {
		http.Error(w, "job_id or result is required", http.StatusBadRequest)
		return
	}

	summary, err := h.Store.ApplyScriptPrepResult(projectID, result, store.ScriptPrepApplyOptions{
		CreateCastProfiles:         req.CreateCastProfiles,
		CreatePronunciationEntries: req.CreatePronunciationEntries,
	})
	if err != nil {
		slog.Error("ScriptPrep: apply result", "err", err)
		http.Error(w, "failed to apply prep result", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(summary)
}
