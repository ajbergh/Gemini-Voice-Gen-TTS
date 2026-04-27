// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — styles.go implements persistence for reusable performance
// style presets and their version snapshots.
package store

import (
	"database/sql"
	"fmt"
	"time"
)

// PerformanceStyle stores a reusable delivery-style preset for TTS rendering.
type PerformanceStyle struct {
	ID            int64   `json:"id"`
	Scope         string  `json:"scope"`
	ProjectID     *int64  `json:"project_id,omitempty"`
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	Category      string  `json:"category"`
	Pacing        *string `json:"pacing,omitempty"`
	Energy        *string `json:"energy,omitempty"`
	Emotion       *string `json:"emotion,omitempty"`
	Articulation  *string `json:"articulation,omitempty"`
	PauseDensity  *string `json:"pause_density,omitempty"`
	DirectorNotes string  `json:"director_notes"`
	AudioTagsJSON *string `json:"audio_tags_json,omitempty"`
	IsBuiltin     bool    `json:"is_builtin"`
	SortOrder     int     `json:"sort_order"`
	MetadataJSON  *string `json:"metadata_json,omitempty"`
	CreatedAt     string  `json:"created_at"`
	UpdatedAt     string  `json:"updated_at"`
}

// PerformanceStyleVersion is a historical snapshot of a PerformanceStyle.
type PerformanceStyleVersion struct {
	ID            int64   `json:"id"`
	StyleID       int64   `json:"style_id"`
	Name          string  `json:"name"`
	Description   string  `json:"description"`
	Category      string  `json:"category"`
	Pacing        *string `json:"pacing,omitempty"`
	Energy        *string `json:"energy,omitempty"`
	Emotion       *string `json:"emotion,omitempty"`
	Articulation  *string `json:"articulation,omitempty"`
	PauseDensity  *string `json:"pause_density,omitempty"`
	DirectorNotes string  `json:"director_notes"`
	AudioTagsJSON *string `json:"audio_tags_json,omitempty"`
	MetadataJSON  *string `json:"metadata_json,omitempty"`
	CreatedAt     string  `json:"created_at"`
}

const styleSelectCols = `id, scope, project_id, name, description, category,
	pacing, energy, emotion, articulation, pause_density,
	director_notes, audio_tags_json, is_builtin, sort_order, metadata_json,
	created_at, updated_at`

// scanStyle maps the shared performance style SELECT columns into a value object.
func scanStyle(row interface{ Scan(...any) error }) (PerformanceStyle, error) {
	var s PerformanceStyle
	var isBuiltin int
	err := row.Scan(
		&s.ID, &s.Scope, &s.ProjectID, &s.Name, &s.Description, &s.Category,
		&s.Pacing, &s.Energy, &s.Emotion, &s.Articulation, &s.PauseDensity,
		&s.DirectorNotes, &s.AudioTagsJSON, &isBuiltin,
		&s.SortOrder, &s.MetadataJSON, &s.CreatedAt, &s.UpdatedAt,
	)
	s.IsBuiltin = isBuiltin == 1
	return s, err
}

// ListStyles returns all global styles plus any project-scoped styles.
// Pass projectID = 0 to fetch only global styles.
func (s *Store) ListStyles(projectID int64) ([]PerformanceStyle, error) {
	var (
		rows *sql.Rows
		err  error
	)
	q := `SELECT ` + styleSelectCols + ` FROM performance_styles`
	if projectID > 0 {
		rows, err = s.db.Query(
			q+` WHERE scope = 'global' OR project_id = ?
			   ORDER BY sort_order ASC, id ASC`,
			projectID,
		)
	} else {
		rows, err = s.db.Query(
			q + ` WHERE scope = 'global' ORDER BY sort_order ASC, id ASC`,
		)
	}
	if err != nil {
		return nil, fmt.Errorf("list styles: %w", err)
	}
	defer rows.Close()

	var styles []PerformanceStyle
	for rows.Next() {
		st, err := scanStyle(rows)
		if err != nil {
			return nil, fmt.Errorf("scan style: %w", err)
		}
		styles = append(styles, st)
	}
	if styles == nil {
		styles = []PerformanceStyle{}
	}
	return styles, rows.Err()
}

// CreateStyle inserts a new performance style and returns its ID.
func (s *Store) CreateStyle(style PerformanceStyle) (int64, error) {
	res, err := s.db.Exec(
		`INSERT INTO performance_styles
		     (scope, project_id, name, description, category, pacing, energy, emotion,
		      articulation, pause_density, director_notes, audio_tags_json,
		      is_builtin, sort_order, metadata_json)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		style.Scope, style.ProjectID, style.Name, style.Description, style.Category,
		style.Pacing, style.Energy, style.Emotion, style.Articulation, style.PauseDensity,
		style.DirectorNotes, style.AudioTagsJSON,
		boolToInt(style.IsBuiltin), style.SortOrder, style.MetadataJSON,
	)
	if err != nil {
		return 0, fmt.Errorf("create style: %w", err)
	}
	return res.LastInsertId()
}

// GetStyle returns a single PerformanceStyle by ID.
func (s *Store) GetStyle(id int64) (*PerformanceStyle, error) {
	row := s.db.QueryRow(
		`SELECT `+styleSelectCols+` FROM performance_styles WHERE id = ?`, id,
	)
	st, err := scanStyle(row)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, fmt.Errorf("get style: %w", err)
	}
	return &st, nil
}

// UpdateStyle snapshots the current state, then updates the style.
// Builtin styles can be updated by a user override (scope stays 'global').
func (s *Store) UpdateStyle(id int64, update PerformanceStyle) (*PerformanceStyle, error) {
	if err := s.snapshotStyle(id); err != nil {
		return nil, err
	}
	_, err := s.db.Exec(
		`UPDATE performance_styles
		    SET name = ?, description = ?, category = ?, pacing = ?, energy = ?,
		        emotion = ?, articulation = ?, pause_density = ?, director_notes = ?,
		        audio_tags_json = ?, sort_order = ?, metadata_json = ?,
		        updated_at = ?
		  WHERE id = ?`,
		update.Name, update.Description, update.Category,
		update.Pacing, update.Energy, update.Emotion,
		update.Articulation, update.PauseDensity, update.DirectorNotes,
		update.AudioTagsJSON, update.SortOrder, update.MetadataJSON,
		time.Now().UTC().Format(time.RFC3339),
		id,
	)
	if err != nil {
		return nil, fmt.Errorf("update style: %w", err)
	}
	return s.GetStyle(id)
}

// DeleteStyle removes a user-created style. Builtin styles are protected.
func (s *Store) DeleteStyle(id int64) error {
	res, err := s.db.Exec(
		`DELETE FROM performance_styles WHERE id = ? AND is_builtin = 0`, id,
	)
	if err != nil {
		return fmt.Errorf("delete style: %w", err)
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("style %d: not found or is a built-in style", id)
	}
	return nil
}

// ListStyleVersions returns the version history for a style, newest first.
func (s *Store) ListStyleVersions(styleID int64) ([]PerformanceStyleVersion, error) {
	rows, err := s.db.Query(
		`SELECT id, style_id, name, description, category, pacing, energy, emotion,
		        articulation, pause_density, director_notes, audio_tags_json,
		        metadata_json, created_at
		   FROM performance_style_versions
		  WHERE style_id = ?
		  ORDER BY created_at DESC, id DESC`,
		styleID,
	)
	if err != nil {
		return nil, fmt.Errorf("list style versions: %w", err)
	}
	defer rows.Close()

	var versions []PerformanceStyleVersion
	for rows.Next() {
		var v PerformanceStyleVersion
		if err := rows.Scan(
			&v.ID, &v.StyleID, &v.Name, &v.Description, &v.Category,
			&v.Pacing, &v.Energy, &v.Emotion, &v.Articulation, &v.PauseDensity,
			&v.DirectorNotes, &v.AudioTagsJSON, &v.MetadataJSON, &v.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan style version: %w", err)
		}
		versions = append(versions, v)
	}
	if versions == nil {
		versions = []PerformanceStyleVersion{}
	}
	return versions, rows.Err()
}

// RevertStyleVersion restores a style to a named version snapshot.
func (s *Store) RevertStyleVersion(styleID, versionID int64) (*PerformanceStyle, error) {
	var v PerformanceStyleVersion
	err := s.db.QueryRow(
		`SELECT id, style_id, name, description, category, pacing, energy, emotion,
		        articulation, pause_density, director_notes, audio_tags_json,
		        metadata_json, created_at
		   FROM performance_style_versions
		  WHERE id = ? AND style_id = ?`,
		versionID, styleID,
	).Scan(
		&v.ID, &v.StyleID, &v.Name, &v.Description, &v.Category,
		&v.Pacing, &v.Energy, &v.Emotion, &v.Articulation, &v.PauseDensity,
		&v.DirectorNotes, &v.AudioTagsJSON, &v.MetadataJSON, &v.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, fmt.Errorf("get style version: %w", err)
	}
	return s.UpdateStyle(styleID, PerformanceStyle{
		Name:          v.Name,
		Description:   v.Description,
		Category:      v.Category,
		Pacing:        v.Pacing,
		Energy:        v.Energy,
		Emotion:       v.Emotion,
		Articulation:  v.Articulation,
		PauseDensity:  v.PauseDensity,
		DirectorNotes: v.DirectorNotes,
		AudioTagsJSON: v.AudioTagsJSON,
		MetadataJSON:  v.MetadataJSON,
	})
}

// snapshotStyle writes the current style fields to performance_style_versions.
func (s *Store) snapshotStyle(id int64) error {
	_, err := s.db.Exec(
		`INSERT INTO performance_style_versions
		     (style_id, name, description, category, pacing, energy, emotion,
		      articulation, pause_density, director_notes, audio_tags_json, metadata_json)
		 SELECT id, name, description, category, pacing, energy, emotion,
		        articulation, pause_density, director_notes, audio_tags_json, metadata_json
		   FROM performance_styles
		  WHERE id = ?`,
		id,
	)
	if err != nil {
		return fmt.Errorf("snapshot style: %w", err)
	}
	return nil
}
