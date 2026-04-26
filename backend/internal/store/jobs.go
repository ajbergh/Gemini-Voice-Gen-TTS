// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — jobs.go implements persisted job state for progress
// reconciliation and future queue execution.
package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// Job represents a persisted async job row.
type Job struct {
	ID             string  `json:"id"`
	Type           string  `json:"type"`
	Status         string  `json:"status"`
	ProjectID      *string `json:"project_id,omitempty"`
	SectionID      *string `json:"section_id,omitempty"`
	SegmentID      *string `json:"segment_id,omitempty"`
	TotalItems     int     `json:"total_items"`
	CompletedItems int     `json:"completed_items"`
	FailedItems    int     `json:"failed_items"`
	Percent        int     `json:"percent"`
	Message        *string `json:"message,omitempty"`
	Error          *string `json:"error,omitempty"`
	ErrorCode      *string `json:"error_code,omitempty"`
	MetadataJSON   *string `json:"metadata_json,omitempty"`
	CreatedAt      string  `json:"created_at"`
	UpdatedAt      string  `json:"updated_at"`
	CompletedAt    *string `json:"completed_at,omitempty"`
}

// JobItem represents a persisted item within a job.
type JobItem struct {
	ID           string  `json:"id"`
	JobID        string  `json:"job_id"`
	SegmentID    *string `json:"segment_id,omitempty"`
	Status       string  `json:"status"`
	AttemptCount int     `json:"attempt_count"`
	LastError    *string `json:"last_error,omitempty"`
	SortOrder    int     `json:"sort_order"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

// JobProgressUpdate is the minimal state carried by a progress event.
type JobProgressUpdate struct {
	ID             string
	Type           string
	Status         string
	Message        string
	Percent        int
	ProjectID      string
	SectionID      string
	SegmentID      string
	TotalItems     int
	CompletedItems int
	FailedItems    int
	ErrorCode      string
	MetadataJSON   string
}

// ListJobs returns the most recently updated jobs.
func (s *Store) ListJobs(limit int) ([]Job, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 200 {
		limit = 200
	}

	rows, err := s.db.Query(
		`SELECT id, job_type, status, project_id, section_id, segment_id, total_items,
		        completed_items, failed_items, percent, message, error, error_code,
		        metadata_json, created_at, updated_at, completed_at
		   FROM jobs
		  ORDER BY updated_at DESC
		  LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("query jobs: %w", err)
	}
	defer rows.Close()

	var jobs []Job
	for rows.Next() {
		job, err := scanJob(rows)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

// GetJob returns a single job by ID.
func (s *Store) GetJob(id string) (*Job, error) {
	row := s.db.QueryRow(
		`SELECT id, job_type, status, project_id, section_id, segment_id, total_items,
		        completed_items, failed_items, percent, message, error, error_code,
		        metadata_json, created_at, updated_at, completed_at
		   FROM jobs
		  WHERE id = ?`,
		id,
	)
	job, err := scanJob(row)
	if err != nil {
		return nil, fmt.Errorf("query job %s: %w", id, err)
	}
	return &job, nil
}

// UpsertJobProgress creates or updates a job from a progress event.
func (s *Store) UpsertJobProgress(update JobProgressUpdate) error {
	if strings.TrimSpace(update.ID) == "" {
		return nil
	}
	if strings.TrimSpace(update.Type) == "" {
		update.Type = "job"
	}
	if strings.TrimSpace(update.Status) == "" {
		update.Status = "processing"
	}

	now := time.Now().UTC().Format(time.RFC3339)
	completedAt := nullableString("")
	status := strings.ToLower(update.Status)
	if isTerminalJobStatus(status) {
		completedAt = nullableString(now)
	}

	errText := ""
	if status == "error" || status == "failed" {
		errText = update.Message
	}

	_, err := s.db.Exec(
		`INSERT INTO jobs (
		     id, job_type, status, project_id, section_id, segment_id, total_items,
		     completed_items, failed_items, percent, message, error, error_code,
		     metadata_json, created_at, updated_at, completed_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT(id) DO UPDATE SET
		     job_type = excluded.job_type,
		     status = excluded.status,
		     project_id = COALESCE(excluded.project_id, jobs.project_id),
		     section_id = COALESCE(excluded.section_id, jobs.section_id),
		     segment_id = COALESCE(excluded.segment_id, jobs.segment_id),
		     total_items = CASE WHEN excluded.total_items > 0 THEN excluded.total_items ELSE jobs.total_items END,
		     completed_items = CASE WHEN excluded.completed_items > 0 THEN excluded.completed_items ELSE jobs.completed_items END,
		     failed_items = CASE WHEN excluded.failed_items > 0 THEN excluded.failed_items ELSE jobs.failed_items END,
		     percent = excluded.percent,
		     message = COALESCE(excluded.message, jobs.message),
		     error = COALESCE(excluded.error, jobs.error),
		     error_code = COALESCE(excluded.error_code, jobs.error_code),
		     metadata_json = COALESCE(excluded.metadata_json, jobs.metadata_json),
		     updated_at = excluded.updated_at,
		     completed_at = COALESCE(excluded.completed_at, jobs.completed_at)`,
		update.ID,
		update.Type,
		update.Status,
		nullableString(update.ProjectID),
		nullableString(update.SectionID),
		nullableString(update.SegmentID),
		update.TotalItems,
		update.CompletedItems,
		update.FailedItems,
		clampPercent(update.Percent),
		nullableString(update.Message),
		nullableString(errText),
		nullableString(update.ErrorCode),
		nullableString(update.MetadataJSON),
		now,
		now,
		completedAt,
	)
	if err != nil {
		return fmt.Errorf("upsert job progress: %w", err)
	}
	return nil
}

type jobScanner interface {
	Scan(dest ...any) error
}

func scanJob(scanner jobScanner) (Job, error) {
	var job Job
	if err := scanner.Scan(
		&job.ID,
		&job.Type,
		&job.Status,
		&job.ProjectID,
		&job.SectionID,
		&job.SegmentID,
		&job.TotalItems,
		&job.CompletedItems,
		&job.FailedItems,
		&job.Percent,
		&job.Message,
		&job.Error,
		&job.ErrorCode,
		&job.MetadataJSON,
		&job.CreatedAt,
		&job.UpdatedAt,
		&job.CompletedAt,
	); err != nil {
		return Job{}, fmt.Errorf("scan job: %w", err)
	}
	return job, nil
}

func nullableString(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return value
}

func clampPercent(value int) int {
	if value < 0 {
		return 0
	}
	if value > 100 {
		return 100
	}
	return value
}

func isTerminalJobStatus(status string) bool {
	switch status {
	case "complete", "completed", "done", "error", "failed", "canceled", "cancelled":
		return true
	default:
		return false
	}
}

var _ jobScanner = (*sql.Row)(nil)
