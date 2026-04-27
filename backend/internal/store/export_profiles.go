// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — export_profiles.go implements persistence for named audio
// finishing/export profiles (silence trim, normalization, padding, etc.).
package store

import (
	"fmt"
	"time"
)

// ExportProfile stores finishing parameters for a named export target.
type ExportProfile struct {
	ID                    int64   `json:"id"`
	Name                  string  `json:"name"`
	TargetKind            string  `json:"target_kind"`
	TrimSilence           bool    `json:"trim_silence"`
	SilenceThresholdDb    float64 `json:"silence_threshold_db"`
	LeadingSilenceMs      int     `json:"leading_silence_ms"`
	TrailingSilenceMs     int     `json:"trailing_silence_ms"`
	InterSegmentSilenceMs int     `json:"inter_segment_silence_ms"`
	NormalizePeakDb       float64 `json:"normalize_peak_db"`
	IsBuiltin             bool    `json:"is_builtin"`
	MetadataJSON          *string `json:"metadata_json,omitempty"`
	CreatedAt             string  `json:"created_at"`
	UpdatedAt             string  `json:"updated_at"`
}

// ListExportProfiles returns all export profiles, builtins first.
func (s *Store) ListExportProfiles() ([]ExportProfile, error) {
	rows, err := s.db.Query(
		`SELECT id, name, target_kind, trim_silence, silence_threshold_db,
		        leading_silence_ms, trailing_silence_ms, inter_segment_silence_ms,
		        normalize_peak_db, is_builtin, metadata_json, created_at, updated_at
		   FROM export_profiles
		  ORDER BY is_builtin DESC, id ASC`,
	)
	if err != nil {
		return nil, fmt.Errorf("query export profiles: %w", err)
	}
	defer rows.Close()

	var profiles []ExportProfile
	for rows.Next() {
		p, err := scanExportProfile(rows)
		if err != nil {
			return nil, err
		}
		profiles = append(profiles, p)
	}
	return profiles, rows.Err()
}

// GetExportProfile returns a single profile by ID.
func (s *Store) GetExportProfile(id int64) (*ExportProfile, error) {
	row := s.db.QueryRow(
		`SELECT id, name, target_kind, trim_silence, silence_threshold_db,
		        leading_silence_ms, trailing_silence_ms, inter_segment_silence_ms,
		        normalize_peak_db, is_builtin, metadata_json, created_at, updated_at
		   FROM export_profiles
		  WHERE id = ?`,
		id,
	)
	p, err := scanExportProfile(row)
	if err != nil {
		return nil, fmt.Errorf("query export profile %d: %w", id, err)
	}
	return &p, nil
}

// CreateExportProfile inserts a custom (non-builtin) export profile.
func (s *Store) CreateExportProfile(p ExportProfile) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`INSERT INTO export_profiles (
		     name, target_kind, trim_silence, silence_threshold_db,
		     leading_silence_ms, trailing_silence_ms, inter_segment_silence_ms,
		     normalize_peak_db, is_builtin, metadata_json, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`,
		p.Name,
		p.TargetKind,
		boolToInt(p.TrimSilence),
		p.SilenceThresholdDb,
		p.LeadingSilenceMs,
		p.TrailingSilenceMs,
		p.InterSegmentSilenceMs,
		p.NormalizePeakDb,
		p.MetadataJSON,
		now,
		now,
	)
	if err != nil {
		return 0, fmt.Errorf("insert export profile: %w", err)
	}
	return result.LastInsertId()
}

// UpdateExportProfile replaces a custom profile's fields. Builtin profiles
// cannot be updated.
func (s *Store) UpdateExportProfile(p ExportProfile) error {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`UPDATE export_profiles
		    SET name = ?, target_kind = ?, trim_silence = ?,
		        silence_threshold_db = ?, leading_silence_ms = ?,
		        trailing_silence_ms = ?, inter_segment_silence_ms = ?,
		        normalize_peak_db = ?, metadata_json = ?, updated_at = ?
		  WHERE id = ? AND is_builtin = 0`,
		p.Name,
		p.TargetKind,
		boolToInt(p.TrimSilence),
		p.SilenceThresholdDb,
		p.LeadingSilenceMs,
		p.TrailingSilenceMs,
		p.InterSegmentSilenceMs,
		p.NormalizePeakDb,
		p.MetadataJSON,
		now,
		p.ID,
	)
	if err != nil {
		return fmt.Errorf("update export profile %d: %w", p.ID, err)
	}
	affected, _ := result.RowsAffected()
	if affected == 0 {
		return fmt.Errorf("export profile %d not found or is builtin", p.ID)
	}
	return nil
}

// DeleteExportProfile removes a custom (non-builtin) profile by ID.
func (s *Store) DeleteExportProfile(id int64) error {
	result, err := s.db.Exec(
		`DELETE FROM export_profiles WHERE id = ? AND is_builtin = 0`,
		id,
	)
	if err != nil {
		return fmt.Errorf("delete export profile %d: %w", id, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return fmt.Errorf("export profile %d not found or is builtin", id)
	}
	return nil
}

type exportProfileScanner interface {
	Scan(dest ...any) error
}

// scanExportProfile maps an export_profiles row into an ExportProfile.
func scanExportProfile(scanner exportProfileScanner) (ExportProfile, error) {
	var p ExportProfile
	var trim, builtin int
	if err := scanner.Scan(
		&p.ID,
		&p.Name,
		&p.TargetKind,
		&trim,
		&p.SilenceThresholdDb,
		&p.LeadingSilenceMs,
		&p.TrailingSilenceMs,
		&p.InterSegmentSilenceMs,
		&p.NormalizePeakDb,
		&builtin,
		&p.MetadataJSON,
		&p.CreatedAt,
		&p.UpdatedAt,
	); err != nil {
		return ExportProfile{}, fmt.Errorf("scan export profile: %w", err)
	}
	p.TrimSilence = trim != 0
	p.IsBuiltin = builtin != 0
	return p, nil
}
