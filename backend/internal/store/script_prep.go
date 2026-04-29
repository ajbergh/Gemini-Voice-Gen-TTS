// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — script_prep.go implements persistence for AI script
// preparation jobs. Each job stores the raw input, a SHA-256 hash for
// deduplication, the structured result JSON, and a processing status.
package store

import (
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"
)

// ScriptPrepJob records a single AI script-prep request and its result.
type ScriptPrepJob struct {
	ID            int64   `json:"id"`
	ProjectID     int64   `json:"project_id"`
	RawScriptHash string  `json:"raw_script_hash"`
	RawScript     string  `json:"raw_script"`
	ResultJSON    *string `json:"result_json,omitempty"`
	Status        string  `json:"status"`
	Error         *string `json:"error,omitempty"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

// ScriptPrepSegment is a proposed renderable segment from AI prep.
type ScriptPrepSegment struct {
	ScriptText   string   `json:"script_text"`
	SpeakerLabel *string  `json:"speaker_label,omitempty"`
	Confidence   *float64 `json:"confidence,omitempty"`
}

// ScriptPrepSection is a proposed project section from AI prep.
type ScriptPrepSection struct {
	Title    string              `json:"title"`
	Kind     string              `json:"kind"`
	Segments []ScriptPrepSegment `json:"segments"`
}

// ScriptPrepSpeakerCandidate is a candidate cast profile from AI prep.
type ScriptPrepSpeakerCandidate struct {
	Label       string   `json:"label"`
	Occurrences int      `json:"occurrences"`
	SampleLines []string `json:"sample_lines"`
}

// ScriptPrepPronunciationCandidate is a candidate pronunciation rule.
type ScriptPrepPronunciationCandidate struct {
	Word     string  `json:"word"`
	Phonetic *string `json:"phonetic,omitempty"`
	Notes    *string `json:"notes,omitempty"`
}

// ScriptPrepResult mirrors the structured JSON returned by AI script prep.
type ScriptPrepResult struct {
	Sections                []ScriptPrepSection                `json:"sections"`
	SpeakerCandidates       []ScriptPrepSpeakerCandidate       `json:"speaker_candidates"`
	PronunciationCandidates []ScriptPrepPronunciationCandidate `json:"pronunciation_candidates"`
	StyleSuggestions        []string                           `json:"style_suggestions"`
	Warnings                []string                           `json:"warnings"`
}

// ScriptPrepApplyOptions controls which candidate assets are materialized.
type ScriptPrepApplyOptions struct {
	CreateCastProfiles         bool
	CreatePronunciationEntries bool
}

// ScriptPrepApplySummary reports records created by ApplyScriptPrepResult.
type ScriptPrepApplySummary struct {
	SectionsCreated             int `json:"sections_created"`
	SegmentsCreated             int `json:"segments_created"`
	CastProfilesCreated         int `json:"cast_profiles_created"`
	PronunciationEntriesCreated int `json:"pronunciation_entries_created"`
}

// CreateScriptPrepJob inserts a new pending prep job for the given project.
func (s *Store) CreateScriptPrepJob(projectID int64, rawScript string) (*ScriptPrepJob, error) {
	hash := fmt.Sprintf("%x", sha256.Sum256([]byte(rawScript)))
	now := time.Now().UTC().Format(time.RFC3339)

	res, err := s.db.Exec(
		`INSERT INTO script_prep_jobs (project_id, raw_script_hash, raw_script, status, created_at, updated_at)
		 VALUES (?, ?, ?, 'pending', ?, ?)`,
		projectID, hash, rawScript, now, now,
	)
	if err != nil {
		return nil, fmt.Errorf("insert script_prep_job: %w", err)
	}
	id, _ := res.LastInsertId()
	return &ScriptPrepJob{
		ID:            id,
		ProjectID:     projectID,
		RawScriptHash: hash,
		RawScript:     rawScript,
		Status:        "pending",
		CreatedAt:     now,
		UpdatedAt:     now,
	}, nil
}

// UpdateScriptPrepJobResult updates a prep job's result, status, and error.
func (s *Store) UpdateScriptPrepJobResult(id int64, resultJSON, status, errMsg string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	var rj, em *string
	if resultJSON != "" {
		rj = &resultJSON
	}
	if errMsg != "" {
		em = &errMsg
	}
	_, err := s.db.Exec(
		`UPDATE script_prep_jobs SET result_json = ?, status = ?, error = ?, updated_at = ? WHERE id = ?`,
		rj, status, em, now, id,
	)
	if err != nil {
		return fmt.Errorf("update script_prep_job %d: %w", id, err)
	}
	return nil
}

// GetScriptPrepJob returns a single script prep job by ID.
func (s *Store) GetScriptPrepJob(id int64) (*ScriptPrepJob, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, raw_script_hash, raw_script, result_json, status, error, created_at, updated_at
		 FROM script_prep_jobs WHERE id = ?`, id,
	)
	return scanScriptPrepJob(row)
}

// GetLatestScriptPrepJob returns the most recent prep job for a project.
func (s *Store) GetLatestScriptPrepJob(projectID int64) (*ScriptPrepJob, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, raw_script_hash, raw_script, result_json, status, error, created_at, updated_at
		 FROM script_prep_jobs WHERE project_id = ? ORDER BY id DESC LIMIT 1`, projectID,
	)
	return scanScriptPrepJob(row)
}

// ListScriptPrepJobs returns all prep jobs for a project, newest first.
func (s *Store) ListScriptPrepJobs(projectID int64) ([]*ScriptPrepJob, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, raw_script_hash, raw_script, result_json, status, error, created_at, updated_at
		 FROM script_prep_jobs WHERE project_id = ? ORDER BY id DESC`, projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list script_prep_jobs: %w", err)
	}
	defer rows.Close()

	var jobs []*ScriptPrepJob
	for rows.Next() {
		job, err := scanScriptPrepJobRow(rows)
		if err != nil {
			return nil, err
		}
		jobs = append(jobs, job)
	}
	return jobs, rows.Err()
}

// ApplyScriptPrepResult appends proposed sections and segments to a project,
// optionally creating cast profiles and pronunciation rules from candidates.
func (s *Store) ApplyScriptPrepResult(projectID int64, result ScriptPrepResult, opts ScriptPrepApplyOptions) (ScriptPrepApplySummary, error) {
	if _, err := s.GetProject(projectID); err != nil {
		return ScriptPrepApplySummary{}, err
	}

	tx, err := s.db.Begin()
	if err != nil {
		return ScriptPrepApplySummary{}, fmt.Errorf("begin script prep apply tx: %w", err)
	}
	defer tx.Rollback()

	now := time.Now().UTC().Format(time.RFC3339)
	summary := ScriptPrepApplySummary{}

	sectionOrder := 0
	if err := tx.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM script_sections WHERE project_id = ?`, projectID).Scan(&sectionOrder); err != nil {
		return summary, fmt.Errorf("get section order: %w", err)
	}
	segmentOrder := 0
	if err := tx.QueryRow(`SELECT COALESCE(MAX(sort_order), -1) + 1 FROM script_segments WHERE project_id = ?`, projectID).Scan(&segmentOrder); err != nil {
		return summary, fmt.Errorf("get segment order: %w", err)
	}

	for _, section := range result.Sections {
		title := strings.TrimSpace(section.Title)
		if title == "" {
			title = fmt.Sprintf("Section %d", summary.SectionsCreated+1)
		}
		kind := defaultString(strings.TrimSpace(section.Kind), "chapter")

		secRes, err := tx.Exec(
			`INSERT INTO script_sections (project_id, kind, title, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`,
			projectID, kind, title, sectionOrder, now, now,
		)
		if err != nil {
			return summary, fmt.Errorf("insert prepared section: %w", err)
		}
		sectionID, _ := secRes.LastInsertId()
		sectionOrder++
		summary.SectionsCreated++

		for _, segment := range section.Segments {
			text := strings.TrimSpace(segment.ScriptText)
			if text == "" {
				continue
			}
			var speaker *string
			if segment.SpeakerLabel != nil {
				if trimmed := strings.TrimSpace(*segment.SpeakerLabel); trimmed != "" {
					speaker = &trimmed
				}
			}
			var metadataJSON *string
			if segment.Confidence != nil {
				metaBytes, _ := json.Marshal(map[string]any{"script_prep_confidence": *segment.Confidence})
				meta := string(metaBytes)
				metadataJSON = &meta
			}
			if _, err := tx.Exec(
				`INSERT INTO script_segments (
				     project_id, section_id, script_text, speaker_label, status,
				     content_hash, sort_order, metadata_json, created_at, updated_at
				 ) VALUES (?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)`,
				projectID, sectionID, text, speaker, hashScriptText(text), segmentOrder, metadataJSON, now, now,
			); err != nil {
				return summary, fmt.Errorf("insert prepared segment: %w", err)
			}
			segmentOrder++
			summary.SegmentsCreated++
		}
	}

	if opts.CreateCastProfiles {
		created, err := s.applyScriptPrepCastCandidates(tx, projectID, result.SpeakerCandidates, now)
		if err != nil {
			return summary, err
		}
		summary.CastProfilesCreated = created
	}

	if opts.CreatePronunciationEntries {
		created, err := s.applyScriptPrepPronunciationCandidates(tx, projectID, result.PronunciationCandidates, now)
		if err != nil {
			return summary, err
		}
		summary.PronunciationEntriesCreated = created
	}

	if err := tx.Commit(); err != nil {
		return summary, fmt.Errorf("commit script prep apply tx: %w", err)
	}
	return summary, nil
}

// applyScriptPrepCastCandidates materializes unique AI-detected speakers as cast profiles.
func (s *Store) applyScriptPrepCastCandidates(tx *sql.Tx, projectID int64, candidates []ScriptPrepSpeakerCandidate, now string) (int, error) {
	rows, err := tx.Query(`SELECT LOWER(name), sort_order FROM cast_profiles WHERE project_id = ?`, projectID)
	if err != nil {
		return 0, fmt.Errorf("list existing cast profiles: %w", err)
	}
	defer rows.Close()

	existing := map[string]bool{}
	sortOrder := 0
	for rows.Next() {
		var name string
		var order int
		if err := rows.Scan(&name, &order); err != nil {
			return 0, fmt.Errorf("scan existing cast profile: %w", err)
		}
		existing[name] = true
		if order >= sortOrder {
			sortOrder = order + 1
		}
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	created := 0
	for _, candidate := range candidates {
		name := strings.TrimSpace(candidate.Label)
		if name == "" {
			continue
		}
		key := strings.ToLower(name)
		if existing[key] {
			continue
		}
		sampleJSONBytes, _ := json.Marshal(candidate.SampleLines)
		sampleJSON := string(sampleJSONBytes)
		description := fmt.Sprintf("Detected by AI script prep in %d occurrence(s).", candidate.Occurrences)
		if _, err := tx.Exec(
			`INSERT INTO cast_profiles (
			     project_id, name, role, description, sample_lines_json, sort_order, created_at, updated_at
			 ) VALUES (?, ?, 'supporting', ?, ?, ?, ?, ?)`,
			projectID, name, description, sampleJSON, sortOrder, now, now,
		); err != nil {
			return created, fmt.Errorf("insert prepared cast profile: %w", err)
		}
		sortOrder++
		created++
		existing[key] = true
	}
	return created, nil
}

// applyScriptPrepPronunciationCandidates upserts the AI Script Prep dictionary
// and appends unique pronunciation candidates as enabled entries.
func (s *Store) applyScriptPrepPronunciationCandidates(tx *sql.Tx, projectID int64, candidates []ScriptPrepPronunciationCandidate, now string) (int, error) {
	if len(candidates) == 0 {
		return 0, nil
	}

	var dictID int64
	err := tx.QueryRow(
		`SELECT id FROM pronunciation_dictionaries
		  WHERE project_id = ? AND name = 'AI Script Prep'
		  ORDER BY id LIMIT 1`,
		projectID,
	).Scan(&dictID)
	if err == sql.ErrNoRows {
		res, err := tx.Exec(
			`INSERT INTO pronunciation_dictionaries (project_id, name, created_at, updated_at)
			 VALUES (?, 'AI Script Prep', ?, ?)`,
			projectID, now, now,
		)
		if err != nil {
			return 0, fmt.Errorf("create script prep dictionary: %w", err)
		}
		dictID, _ = res.LastInsertId()
	} else if err != nil {
		return 0, fmt.Errorf("get script prep dictionary: %w", err)
	}

	rows, err := tx.Query(`SELECT LOWER(raw_word), sort_order FROM pronunciation_entries WHERE dictionary_id = ?`, dictID)
	if err != nil {
		return 0, fmt.Errorf("list script prep dictionary entries: %w", err)
	}
	defer rows.Close()

	existing := map[string]bool{}
	sortOrder := 0
	for rows.Next() {
		var raw string
		var order int
		if err := rows.Scan(&raw, &order); err != nil {
			return 0, fmt.Errorf("scan script prep dictionary entry: %w", err)
		}
		existing[raw] = true
		if order >= sortOrder {
			sortOrder = order + 1
		}
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	created := 0
	for _, candidate := range candidates {
		word := strings.TrimSpace(candidate.Word)
		if word == "" || existing[strings.ToLower(word)] {
			continue
		}
		replacement := word
		if candidate.Phonetic != nil && strings.TrimSpace(*candidate.Phonetic) != "" {
			replacement = strings.TrimSpace(*candidate.Phonetic)
		}
		if candidate.Notes != nil && strings.TrimSpace(*candidate.Notes) != "" && replacement == word {
			replacement = strings.TrimSpace(*candidate.Notes)
		}
		if _, err := tx.Exec(
			`INSERT INTO pronunciation_entries
			     (dictionary_id, raw_word, replacement, enabled, sort_order, created_at, updated_at)
			 VALUES (?, ?, ?, 1, ?, ?, ?)`,
			dictID, word, replacement, sortOrder, now, now,
		); err != nil {
			return created, fmt.Errorf("insert script prep pronunciation entry: %w", err)
		}
		sortOrder++
		created++
		existing[strings.ToLower(word)] = true
	}
	return created, nil
}

// scanScriptPrepJob scans a single *sql.Row.
func scanScriptPrepJob(row *sql.Row) (*ScriptPrepJob, error) {
	var j ScriptPrepJob
	err := row.Scan(
		&j.ID, &j.ProjectID, &j.RawScriptHash, &j.RawScript,
		&j.ResultJSON, &j.Status, &j.Error, &j.CreatedAt, &j.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("scan script_prep_job: %w", err)
	}
	return &j, nil
}

// scanScriptPrepJobRow scans a row from *sql.Rows.
func scanScriptPrepJobRow(rows *sql.Rows) (*ScriptPrepJob, error) {
	var j ScriptPrepJob
	err := rows.Scan(
		&j.ID, &j.ProjectID, &j.RawScriptHash, &j.RawScript,
		&j.ResultJSON, &j.Status, &j.Error, &j.CreatedAt, &j.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("scan script_prep_job row: %w", err)
	}
	return &j, nil
}
