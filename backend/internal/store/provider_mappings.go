// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — provider_mappings.go stores project-scoped voice mappings
// used when fallback renders switch between providers with different voice sets.
package store

import (
	"database/sql"
	"fmt"
	"time"
)

// ProviderVoiceMapping maps an app/source provider voice to a target provider voice.
type ProviderVoiceMapping struct {
	ID             int64  `json:"id"`
	ProjectID      *int64 `json:"project_id,omitempty"`
	SourceProvider string `json:"source_provider"`
	SourceVoice    string `json:"source_voice"`
	TargetProvider string `json:"target_provider"`
	TargetVoice    string `json:"target_voice"`
	Notes          string `json:"notes"`
	CreatedAt      string `json:"created_at"`
	UpdatedAt      string `json:"updated_at"`
}

// ListProviderVoiceMappings returns global mappings plus mappings scoped to a project.
func (s *Store) ListProviderVoiceMappings(projectID int64) ([]ProviderVoiceMapping, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, source_provider, source_voice, target_provider,
		        target_voice, notes, created_at, updated_at
		   FROM provider_voice_mappings
		  WHERE project_id IS NULL OR project_id = ?
		  ORDER BY project_id IS NOT NULL DESC, source_provider, target_provider, source_voice`,
		projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list provider voice mappings: %w", err)
	}
	defer rows.Close()

	var out []ProviderVoiceMapping
	for rows.Next() {
		m, err := scanProviderVoiceMapping(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// FindProviderVoiceMapping returns the best mapping for a source voice.
func (s *Store) FindProviderVoiceMapping(projectID int64, sourceProvider, sourceVoice, targetProvider string) (*ProviderVoiceMapping, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, source_provider, source_voice, target_provider,
		        target_voice, notes, created_at, updated_at
		   FROM provider_voice_mappings
		  WHERE (project_id = ? OR project_id IS NULL)
		    AND source_provider = ?
		    AND source_voice = ?
		    AND target_provider = ?
		  ORDER BY project_id IS NOT NULL DESC
		  LIMIT 1`,
		projectID, sourceProvider, sourceVoice, targetProvider,
	)
	m, err := scanProviderVoiceMapping(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("find provider voice mapping: %w", err)
	}
	return &m, nil
}

// UpsertProviderVoiceMapping creates or updates a voice mapping.
func (s *Store) UpsertProviderVoiceMapping(m ProviderVoiceMapping) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	tx, err := s.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("begin provider voice mapping upsert: %w", err)
	}
	defer tx.Rollback()

	var existingID int64
	err = tx.QueryRow(
		`SELECT id
		   FROM provider_voice_mappings
		  WHERE ((project_id = ? AND ? IS NOT NULL) OR (project_id IS NULL AND ? IS NULL))
		    AND source_provider = ?
		    AND source_voice = ?
		    AND target_provider = ?
		  LIMIT 1`,
		m.ProjectID,
		m.ProjectID,
		m.ProjectID,
		m.SourceProvider,
		m.SourceVoice,
		m.TargetProvider,
	).Scan(&existingID)
	if err != nil && err != sql.ErrNoRows {
		return 0, fmt.Errorf("find provider voice mapping for upsert: %w", err)
	}
	if err == nil {
		if _, err := tx.Exec(
			`UPDATE provider_voice_mappings
			    SET target_voice = ?,
			        notes = ?,
			        updated_at = ?
			  WHERE id = ?`,
			m.TargetVoice,
			m.Notes,
			now,
			existingID,
		); err != nil {
			return 0, fmt.Errorf("update provider voice mapping: %w", err)
		}
		if err := tx.Commit(); err != nil {
			return 0, fmt.Errorf("commit provider voice mapping upsert: %w", err)
		}
		return existingID, nil
	}

	res, err := tx.Exec(
		`INSERT INTO provider_voice_mappings (
		     project_id, source_provider, source_voice, target_provider, target_voice,
		     notes, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		m.ProjectID,
		m.SourceProvider,
		m.SourceVoice,
		m.TargetProvider,
		m.TargetVoice,
		m.Notes,
		now,
		now,
	)
	if err != nil {
		return 0, fmt.Errorf("upsert provider voice mapping: %w", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("provider voice mapping id: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit provider voice mapping upsert: %w", err)
	}
	return id, nil
}

// DeleteProviderVoiceMapping removes a voice mapping by ID.
func (s *Store) DeleteProviderVoiceMapping(id int64) error {
	res, err := s.db.Exec(`DELETE FROM provider_voice_mappings WHERE id = ?`, id)
	if err != nil {
		return fmt.Errorf("delete provider voice mapping %d: %w", id, err)
	}
	if affected, _ := res.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

type providerVoiceMappingScanner interface {
	Scan(dest ...any) error
}

func scanProviderVoiceMapping(scanner providerVoiceMappingScanner) (ProviderVoiceMapping, error) {
	var m ProviderVoiceMapping
	if err := scanner.Scan(
		&m.ID,
		&m.ProjectID,
		&m.SourceProvider,
		&m.SourceVoice,
		&m.TargetProvider,
		&m.TargetVoice,
		&m.Notes,
		&m.CreatedAt,
		&m.UpdatedAt,
	); err != nil {
		return ProviderVoiceMapping{}, err
	}
	return m, nil
}
