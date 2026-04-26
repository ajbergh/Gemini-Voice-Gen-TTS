// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — qc.go implements persistence for QC issues and take approval.
package store

import (
	"fmt"
	"time"
)

// QcIssue represents a review issue logged against a segment or take.
type QcIssue struct {
	ID                int64    `json:"id"`
	ProjectID         int64    `json:"project_id"`
	SectionID         *int64   `json:"section_id,omitempty"`
	SegmentID         int64    `json:"segment_id"`
	TakeID            *int64   `json:"take_id,omitempty"`
	IssueType         string   `json:"issue_type"`
	Severity          string   `json:"severity"`
	Note              string   `json:"note"`
	TimeOffsetSeconds *float64 `json:"time_offset_seconds,omitempty"`
	Status            string   `json:"status"`
	CreatedAt         string   `json:"created_at"`
	UpdatedAt         string   `json:"updated_at"`
}

// QcRollup summarises unresolved issue counts for a project.
type QcRollup struct {
	ProjectID     int64 `json:"project_id"`
	OpenCount     int   `json:"open_count"`
	ResolvedCount int   `json:"resolved_count"`
	WontFixCount  int   `json:"wont_fix_count"`
}

// SegmentQcStatus reports open issue count for a single segment.
type SegmentQcStatus struct {
	SegmentID int64 `json:"segment_id"`
	OpenCount int   `json:"open_count"`
}

const qcSelectCols = `id, project_id, section_id, segment_id, take_id,
	issue_type, severity, note, time_offset_seconds, status,
	created_at, updated_at`

func scanQcIssue(row interface{ Scan(...any) error }) (QcIssue, error) {
	var q QcIssue
	return q, row.Scan(
		&q.ID, &q.ProjectID, &q.SectionID, &q.SegmentID, &q.TakeID,
		&q.IssueType, &q.Severity, &q.Note, &q.TimeOffsetSeconds, &q.Status,
		&q.CreatedAt, &q.UpdatedAt,
	)
}

// ListProjectQcIssues returns all QC issues for a project, optionally
// filtered by status.
func (s *Store) ListProjectQcIssues(projectID int64, status string) ([]QcIssue, error) {
	q := `SELECT ` + qcSelectCols + ` FROM qc_issues WHERE project_id = ?`
	args := []any{projectID}
	if status != "" {
		q += ` AND status = ?`
		args = append(args, status)
	}
	q += ` ORDER BY created_at DESC`

	rows, err := s.db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("list qc issues: %w", err)
	}
	defer rows.Close()

	var issues []QcIssue
	for rows.Next() {
		issue, err := scanQcIssue(rows)
		if err != nil {
			return nil, fmt.Errorf("scan qc issue: %w", err)
		}
		issues = append(issues, issue)
	}
	return issues, rows.Err()
}

// ListSegmentQcIssues returns all QC issues for a specific segment.
func (s *Store) ListSegmentQcIssues(projectID, segmentID int64) ([]QcIssue, error) {
	rows, err := s.db.Query(
		`SELECT `+qcSelectCols+` FROM qc_issues
		 WHERE project_id = ? AND segment_id = ?
		 ORDER BY created_at DESC`,
		projectID, segmentID,
	)
	if err != nil {
		return nil, fmt.Errorf("list segment qc issues: %w", err)
	}
	defer rows.Close()

	var issues []QcIssue
	for rows.Next() {
		issue, err := scanQcIssue(rows)
		if err != nil {
			return nil, fmt.Errorf("scan qc issue: %w", err)
		}
		issues = append(issues, issue)
	}
	return issues, rows.Err()
}

// CreateQcIssue inserts a new QC issue and returns its assigned ID.
func (s *Store) CreateQcIssue(issue QcIssue) (int64, error) {
	if issue.IssueType == "" {
		issue.IssueType = "other"
	}
	if issue.Severity == "" {
		issue.Severity = "medium"
	}
	if issue.Status == "" {
		issue.Status = "open"
	}
	now := time.Now().UTC().Format("2006-01-02T15:04:05.999Z")
	res, err := s.db.Exec(
		`INSERT INTO qc_issues
		 (project_id, section_id, segment_id, take_id,
		  issue_type, severity, note, time_offset_seconds, status,
		  created_at, updated_at)
		 VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
		issue.ProjectID, issue.SectionID, issue.SegmentID, issue.TakeID,
		issue.IssueType, issue.Severity, issue.Note, issue.TimeOffsetSeconds, issue.Status,
		now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("create qc issue: %w", err)
	}
	return res.LastInsertId()
}

// GetQcIssue returns a single QC issue by ID, verifying project ownership.
func (s *Store) GetQcIssue(projectID, issueID int64) (*QcIssue, error) {
	row := s.db.QueryRow(
		`SELECT `+qcSelectCols+` FROM qc_issues
		 WHERE id = ? AND project_id = ?`,
		issueID, projectID,
	)
	issue, err := scanQcIssue(row)
	if err != nil {
		return nil, fmt.Errorf("get qc issue: %w", err)
	}
	return &issue, nil
}

// UpdateQcIssue replaces updatable fields on an existing QC issue.
func (s *Store) UpdateQcIssue(projectID, issueID int64, update QcIssue) error {
	now := time.Now().UTC().Format("2006-01-02T15:04:05.999Z")
	res, err := s.db.Exec(
		`UPDATE qc_issues
		 SET issue_type=?, severity=?, note=?, time_offset_seconds=?, status=?,
		     take_id=?, updated_at=?
		 WHERE id=? AND project_id=?`,
		update.IssueType, update.Severity, update.Note, update.TimeOffsetSeconds, update.Status,
		update.TakeID, now, issueID, projectID,
	)
	if err != nil {
		return fmt.Errorf("update qc issue: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("qc issue %d not found", issueID)
	}
	return nil
}

// ResolveQcIssue transitions a QC issue to the "resolved" status.
func (s *Store) ResolveQcIssue(projectID, issueID int64) error {
	now := time.Now().UTC().Format("2006-01-02T15:04:05.999Z")
	res, err := s.db.Exec(
		`UPDATE qc_issues SET status='resolved', updated_at=?
		 WHERE id=? AND project_id=?`,
		now, issueID, projectID,
	)
	if err != nil {
		return fmt.Errorf("resolve qc issue: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("qc issue %d not found", issueID)
	}
	return nil
}

// DeleteQcIssue permanently removes a QC issue.
func (s *Store) DeleteQcIssue(projectID, issueID int64) error {
	res, err := s.db.Exec(
		`DELETE FROM qc_issues WHERE id=? AND project_id=?`,
		issueID, projectID,
	)
	if err != nil {
		return fmt.Errorf("delete qc issue: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("qc issue %d not found", issueID)
	}
	return nil
}

// GetProjectQcRollup returns aggregate open/resolved/wont_fix issue counts.
func (s *Store) GetProjectQcRollup(projectID int64) (QcRollup, error) {
	rows, err := s.db.Query(
		`SELECT status, COUNT(*) FROM qc_issues
		 WHERE project_id = ?
		 GROUP BY status`,
		projectID,
	)
	if err != nil {
		return QcRollup{}, fmt.Errorf("qc rollup: %w", err)
	}
	defer rows.Close()

	rollup := QcRollup{ProjectID: projectID}
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return rollup, fmt.Errorf("scan rollup row: %w", err)
		}
		switch status {
		case "open":
			rollup.OpenCount = count
		case "resolved":
			rollup.ResolvedCount = count
		case "wont_fix":
			rollup.WontFixCount = count
		}
	}
	return rollup, rows.Err()
}

// ListSegmentQcStatus returns open issue counts per segment for a project.
func (s *Store) ListSegmentQcStatus(projectID int64) ([]SegmentQcStatus, error) {
	rows, err := s.db.Query(
		`SELECT segment_id, COUNT(*) FROM qc_issues
		 WHERE project_id = ? AND status = 'open'
		 GROUP BY segment_id`,
		projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list segment qc status: %w", err)
	}
	defer rows.Close()

	var out []SegmentQcStatus
	for rows.Next() {
		var ss SegmentQcStatus
		if err := rows.Scan(&ss.SegmentID, &ss.OpenCount); err != nil {
			return nil, fmt.Errorf("scan segment qc status: %w", err)
		}
		out = append(out, ss)
	}
	return out, rows.Err()
}

// SetTakeStatus updates the status of a segment take (e.g., "approved", "flagged", "rendered").
func (s *Store) SetTakeStatus(projectID, takeID int64, status string) error {
	res, err := s.db.Exec(
		`UPDATE segment_takes SET status=? WHERE id=? AND project_id=?`,
		status, takeID, projectID,
	)
	if err != nil {
		return fmt.Errorf("set take status: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("take %d not found", takeID)
	}
	return nil
}
