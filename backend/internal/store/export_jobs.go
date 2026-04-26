// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — export_jobs.go tracks deliverable packaging export jobs.
package store

import (
	"database/sql"
	"fmt"
	"time"
)

// ExportJob tracks a packaging/deliverable export operation.
type ExportJob struct {
	ID              int64   `json:"id"`
	ProjectID       int64   `json:"project_id"`
	ExportProfileID *int64  `json:"export_profile_id,omitempty"`
	Status          string  `json:"status"`
	OutputPath      *string `json:"output_path,omitempty"`
	Error           *string `json:"error,omitempty"`
	MetadataJSON    *string `json:"metadata_json,omitempty"`
	CreatedAt       string  `json:"created_at"`
	UpdatedAt       string  `json:"updated_at"`
}

// CreateExportJob inserts a new pending export job for the given project.
func (s *Store) CreateExportJob(projectID int64, profileID *int64) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`INSERT INTO export_jobs (project_id, export_profile_id, status, created_at, updated_at)
		 VALUES (?, ?, 'pending', ?, ?)`,
		projectID, profileID, now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("create export job: %w", err)
	}
	return result.LastInsertId()
}

// GetExportJob returns an export job by ID. Returns nil if not found.
func (s *Store) GetExportJob(id int64) (*ExportJob, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, export_profile_id, status, output_path, error,
		        metadata_json, created_at, updated_at
		   FROM export_jobs WHERE id = ?`,
		id,
	)
	j, err := scanExportJob(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get export job %d: %w", id, err)
	}
	return &j, nil
}

// ListExportJobs returns all export jobs for a project, newest first.
func (s *Store) ListExportJobs(projectID int64) ([]ExportJob, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, export_profile_id, status, output_path, error,
		        metadata_json, created_at, updated_at
		   FROM export_jobs WHERE project_id = ? ORDER BY id DESC`,
		projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list export jobs: %w", err)
	}
	defer rows.Close()
	var jobs []ExportJob
	for rows.Next() {
		j, err := scanExportJob(rows)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, j)
	}
	return jobs, rows.Err()
}

// UpdateExportJobStatus sets the status, output_path, and error on an export job.
func (s *Store) UpdateExportJobStatus(id int64, status string, outputPath *string, errMsg *string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		`UPDATE export_jobs SET status = ?, output_path = ?, error = ?, updated_at = ? WHERE id = ?`,
		status, outputPath, errMsg, now, id,
	)
	if err != nil {
		return fmt.Errorf("update export job %d: %w", id, err)
	}
	return nil
}

type exportJobScanner interface {
	Scan(dest ...any) error
}

func scanExportJob(sc exportJobScanner) (ExportJob, error) {
	var j ExportJob
	if err := sc.Scan(
		&j.ID, &j.ProjectID, &j.ExportProfileID,
		&j.Status, &j.OutputPath, &j.Error, &j.MetadataJSON,
		&j.CreatedAt, &j.UpdatedAt,
	); err != nil {
		return ExportJob{}, fmt.Errorf("scan export job: %w", err)
	}
	return j, nil
}
