// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_qc.go implements QC issue and take-approval endpoints.
package handler

import (
	"bytes"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// QcHandler handles review, QC issue, and take-approval endpoints.
type QcHandler struct {
	Store *store.Store
}

// ListProjectQcIssues returns all QC issues for a project.
// Optional ?status= filter (open|resolved|wont_fix).
//
// GET /api/projects/{id}/qc
func (h *QcHandler) ListProjectQcIssues(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	status := r.URL.Query().Get("status")
	issues, err := h.Store.ListProjectQcIssues(projectID, status)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list qc issues")
		return
	}
	if issues == nil {
		issues = []store.QcIssue{}
	}
	writeJSON(w, http.StatusOK, issues)
}

// CreateQcIssue logs a new QC issue against a project segment or take.
//
// POST /api/projects/{id}/qc
func (h *QcHandler) CreateQcIssue(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	var req store.QcIssue
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.SegmentID <= 0 {
		writeError(w, http.StatusBadRequest, "segment_id is required")
		return
	}
	req.ProjectID = projectID

	issueID, err := h.Store.CreateQcIssue(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create qc issue")
		return
	}

	issue, err := h.Store.GetQcIssue(projectID, issueID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to retrieve created qc issue")
		return
	}
	writeJSON(w, http.StatusCreated, issue)
}

// GetQcIssue returns a single QC issue.
//
// GET /api/qc/{issueId}
func (h *QcHandler) GetQcIssue(w http.ResponseWriter, r *http.Request) {
	projectID, issueID, ok := h.requireProjectAndIssue(w, r)
	if !ok {
		return
	}
	issue, err := h.Store.GetQcIssue(projectID, issueID)
	if err != nil {
		writeStoreError(w, err, "qc issue not found", "failed to get qc issue")
		return
	}
	writeJSON(w, http.StatusOK, issue)
}

// UpdateQcIssue replaces updatable fields on a QC issue.
//
// PUT /api/qc/{issueId}
func (h *QcHandler) UpdateQcIssue(w http.ResponseWriter, r *http.Request) {
	projectID, issueID, ok := h.requireProjectAndIssue(w, r)
	if !ok {
		return
	}
	existing, err := h.Store.GetQcIssue(projectID, issueID)
	if err != nil {
		writeStoreError(w, err, "qc issue not found", "failed to get qc issue")
		return
	}
	var req store.QcIssue
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	// Carry forward read-only fields.
	req.ProjectID = existing.ProjectID
	req.SegmentID = existing.SegmentID
	if err := h.Store.UpdateQcIssue(projectID, issueID, req); err != nil {
		writeStoreError(w, err, "qc issue not found", "failed to update qc issue")
		return
	}
	updated, err := h.Store.GetQcIssue(projectID, issueID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to retrieve updated qc issue")
		return
	}
	writeJSON(w, http.StatusOK, updated)
}

// DeleteQcIssue permanently removes a QC issue.
//
// DELETE /api/qc/{issueId}
func (h *QcHandler) DeleteQcIssue(w http.ResponseWriter, r *http.Request) {
	projectID, issueID, ok := h.requireProjectAndIssue(w, r)
	if !ok {
		return
	}
	if err := h.Store.DeleteQcIssue(projectID, issueID); err != nil {
		writeStoreError(w, err, "qc issue not found", "failed to delete qc issue")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ResolveQcIssue transitions a QC issue to "resolved".
//
// POST /api/qc/{issueId}/resolve
func (h *QcHandler) ResolveQcIssue(w http.ResponseWriter, r *http.Request) {
	projectID, issueID, ok := h.requireProjectAndIssue(w, r)
	if !ok {
		return
	}
	if err := h.Store.ResolveQcIssue(projectID, issueID); err != nil {
		writeStoreError(w, err, "qc issue not found", "failed to resolve qc issue")
		return
	}
	issue, err := h.Store.GetQcIssue(projectID, issueID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to retrieve resolved issue")
		return
	}
	writeJSON(w, http.StatusOK, issue)
}

// GetProjectQcRollup returns aggregate open/resolved/wont_fix issue counts.
//
// GET /api/projects/{id}/qc/rollup
func (h *QcHandler) GetProjectQcRollup(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	rollup, err := h.Store.GetProjectQcRollup(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get qc rollup")
		return
	}
	writeJSON(w, http.StatusOK, rollup)
}

// ExportQcIssues exports all QC issues for a project as CSV or Markdown.
// Format is selected via ?format=csv (default) or ?format=markdown.
//
// GET /api/projects/{id}/qc/export
func (h *QcHandler) ExportQcIssues(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	issues, err := h.Store.ListProjectQcIssues(projectID, "")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list qc issues")
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = h.Store.GetConfigValue(store.ConfigKeyQcExportNotesFormat, "csv")
	}

	switch format {
	case "csv":
		w.Header().Set("Content-Type", "text/csv; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="qc-issues-project-%d.csv"`, projectID))
		w.WriteHeader(http.StatusOK)
		var buf bytes.Buffer
		buf.WriteString("id,segment_id,issue_type,severity,status,note,time_offset_seconds,created_at\n")
		for _, q := range issues {
			offset := ""
			if q.TimeOffsetSeconds != nil {
				offset = fmt.Sprintf("%.3f", *q.TimeOffsetSeconds)
			}
			note := strings.ReplaceAll(q.Note, `"`, `""`)
			buf.WriteString(fmt.Sprintf("%d,%d,%s,%s,%s,\"%s\",%s,%s\n",
				q.ID, q.SegmentID, q.IssueType, q.Severity, q.Status, note, offset, q.CreatedAt))
		}
		_, _ = w.Write(buf.Bytes())

	case "markdown":
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="qc-issues-project-%d.md"`, projectID))
		w.WriteHeader(http.StatusOK)
		var buf bytes.Buffer
		buf.WriteString("# QC Issues\n\n")
		buf.WriteString("| ID | Segment | Type | Severity | Status | Note | Offset |\n")
		buf.WriteString("|---|---|---|---|---|---|---|\n")
		for _, q := range issues {
			offset := ""
			if q.TimeOffsetSeconds != nil {
				offset = fmt.Sprintf("%.3fs", *q.TimeOffsetSeconds)
			}
			note := strings.ReplaceAll(q.Note, "|", "\\|")
			buf.WriteString(fmt.Sprintf("| %d | %d | %s | %s | %s | %s | %s |\n",
				q.ID, q.SegmentID, q.IssueType, q.Severity, q.Status, note, offset))
		}
		_, _ = w.Write(buf.Bytes())

	default:
		writeError(w, http.StatusBadRequest, "format must be csv or markdown")
	}
}

// ApproveTake sets a segment take status to "approved".
//
// POST /api/projects/{id}/takes/{takeId}/approve
func (h *QcHandler) ApproveTake(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	takeID, ok := parsePathInt64(w, r, "takeId", "invalid take ID")
	if !ok {
		return
	}
	if err := h.Store.SetTakeStatus(projectID, takeID, "approved"); err != nil {
		writeStoreError(w, err, "take not found", "failed to approve take")
		return
	}
	take, err := h.Store.GetTake(projectID, takeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to retrieve take")
		return
	}
	writeJSON(w, http.StatusOK, take)
}

// FlagTake sets a segment take status to "flagged".
//
// POST /api/projects/{id}/takes/{takeId}/flag
func (h *QcHandler) FlagTake(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	takeID, ok := parsePathInt64(w, r, "takeId", "invalid take ID")
	if !ok {
		return
	}
	if err := h.Store.SetTakeStatus(projectID, takeID, "flagged"); err != nil {
		writeStoreError(w, err, "take not found", "failed to flag take")
		return
	}
	take, err := h.Store.GetTake(projectID, takeID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to retrieve take")
		return
	}
	writeJSON(w, http.StatusOK, take)
}

// requireProject parses {id} and verifies the project exists.
func (h *QcHandler) requireProject(w http.ResponseWriter, r *http.Request) (int64, bool) {
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

// requireProjectAndIssue resolves the issue by ID and returns its project_id for
// ownership scoping on routes like /api/qc/{issueId}.
func (h *QcHandler) requireProjectAndIssue(w http.ResponseWriter, r *http.Request) (int64, int64, bool) {
	issueID, ok := parsePathInt64(w, r, "issueId", "invalid issue ID")
	if !ok {
		return 0, 0, false
	}
	// Look up the project_id from the issue itself so callers don't need to supply it.
	row := h.Store.DB().QueryRow(
		`SELECT project_id FROM qc_issues WHERE id = ?`, issueID,
	)
	var projID int64
	if err := row.Scan(&projID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			writeError(w, http.StatusNotFound, "qc issue not found")
		} else {
			writeError(w, http.StatusInternalServerError, "failed to look up qc issue")
		}
		return 0, 0, false
	}
	return projID, issueID, true
}
