// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — cast.go implements persistence for project cast bible
// profiles and version snapshots.
package store

import (
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// CastProfile stores a narrator, character, or brand voice assignment for a project.
type CastProfile struct {
	ID                 int64   `json:"id"`
	ProjectID          int64   `json:"project_id"`
	SeriesID           *int64  `json:"series_id,omitempty"`
	Name               string  `json:"name"`
	Role               string  `json:"role"`
	Description        string  `json:"description"`
	VoiceName          *string `json:"voice_name,omitempty"`
	PresetID           *int64  `json:"preset_id,omitempty"`
	StyleID            *int64  `json:"style_id,omitempty"`
	AccentID           *string `json:"accent_id,omitempty"`
	LanguageCode       *string `json:"language_code,omitempty"`
	AgeImpression      *string `json:"age_impression,omitempty"`
	EmotionalRange     *string `json:"emotional_range,omitempty"`
	SampleLinesJSON    *string `json:"sample_lines_json,omitempty"`
	PronunciationNotes *string `json:"pronunciation_notes,omitempty"`
	MetadataJSON       *string `json:"metadata_json,omitempty"`
	SortOrder          int     `json:"sort_order"`
	CreatedAt          string  `json:"created_at"`
	UpdatedAt          string  `json:"updated_at"`
}

// CastProfileVersion is a historical snapshot of a cast profile.
type CastProfileVersion struct {
	ID                 int64   `json:"id"`
	ProfileID          int64   `json:"profile_id"`
	Name               string  `json:"name"`
	Role               string  `json:"role"`
	Description        string  `json:"description"`
	VoiceName          *string `json:"voice_name,omitempty"`
	PresetID           *int64  `json:"preset_id,omitempty"`
	StyleID            *int64  `json:"style_id,omitempty"`
	AccentID           *string `json:"accent_id,omitempty"`
	LanguageCode       *string `json:"language_code,omitempty"`
	AgeImpression      *string `json:"age_impression,omitempty"`
	EmotionalRange     *string `json:"emotional_range,omitempty"`
	SampleLinesJSON    *string `json:"sample_lines_json,omitempty"`
	PronunciationNotes *string `json:"pronunciation_notes,omitempty"`
	MetadataJSON       *string `json:"metadata_json,omitempty"`
	SortOrder          int     `json:"sort_order"`
	CreatedAt          string  `json:"created_at"`
}

// ListCastProfiles returns all cast profiles for a project.
func (s *Store) ListCastProfiles(projectID int64) ([]CastProfile, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, series_id, name, role, description, voice_name,
		        preset_id, style_id, accent_id, language_code, age_impression,
		        emotional_range, sample_lines_json, pronunciation_notes,
		        metadata_json, sort_order, created_at, updated_at
		   FROM cast_profiles
		  WHERE project_id = ?
		  ORDER BY sort_order ASC, role ASC, name ASC, id ASC`,
		projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("query cast profiles: %w", err)
	}
	defer rows.Close()

	var profiles []CastProfile
	for rows.Next() {
		profile, err := scanCastProfile(rows)
		if err != nil {
			return nil, err
		}
		profiles = append(profiles, profile)
	}
	return profiles, rows.Err()
}

// CreateCastProfile inserts a project-scoped cast profile.
func (s *Store) CreateCastProfile(projectID int64, profile CastProfile) (int64, error) {
	if _, err := s.GetProject(projectID); err != nil {
		return 0, err
	}
	profile.ProjectID = projectID
	profile.Role = defaultString(profile.Role, "supporting")
	now := time.Now().UTC().Format(time.RFC3339)

	result, err := s.db.Exec(
		`INSERT INTO cast_profiles (
		     project_id, series_id, name, role, description, voice_name, preset_id,
		     style_id, accent_id, language_code, age_impression, emotional_range,
		     sample_lines_json, pronunciation_notes, metadata_json, sort_order,
		     created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		profile.ProjectID,
		profile.SeriesID,
		strings.TrimSpace(profile.Name),
		profile.Role,
		profile.Description,
		profile.VoiceName,
		profile.PresetID,
		profile.StyleID,
		profile.AccentID,
		profile.LanguageCode,
		profile.AgeImpression,
		profile.EmotionalRange,
		profile.SampleLinesJSON,
		profile.PronunciationNotes,
		profile.MetadataJSON,
		profile.SortOrder,
		now,
		now,
	)
	if err != nil {
		return 0, fmt.Errorf("insert cast profile: %w", err)
	}
	return result.LastInsertId()
}

// GetCastProfile returns one cast profile by ID.
func (s *Store) GetCastProfile(profileID int64) (*CastProfile, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, series_id, name, role, description, voice_name,
		        preset_id, style_id, accent_id, language_code, age_impression,
		        emotional_range, sample_lines_json, pronunciation_notes,
		        metadata_json, sort_order, created_at, updated_at
		   FROM cast_profiles
		  WHERE id = ?`,
		profileID,
	)
	profile, err := scanCastProfile(row)
	if err != nil {
		return nil, fmt.Errorf("query cast profile %d: %w", profileID, err)
	}
	return &profile, nil
}

// UpdateCastProfile replaces mutable cast profile fields and snapshots the old profile.
func (s *Store) UpdateCastProfile(profileID int64, profile CastProfile) error {
	existing, err := s.GetCastProfile(profileID)
	if err != nil {
		return err
	}
	if err := s.snapshotCastProfileVersion(profileID); err != nil {
		return err
	}

	profile.ProjectID = existing.ProjectID
	profile.Role = defaultString(profile.Role, existing.Role)
	now := time.Now().UTC().Format(time.RFC3339)

	result, err := s.db.Exec(
		`UPDATE cast_profiles
		    SET series_id = ?, name = ?, role = ?, description = ?, voice_name = ?,
		        preset_id = ?, style_id = ?, accent_id = ?, language_code = ?,
		        age_impression = ?, emotional_range = ?, sample_lines_json = ?,
		        pronunciation_notes = ?, metadata_json = ?, sort_order = ?,
		        updated_at = ?
		  WHERE id = ?`,
		profile.SeriesID,
		strings.TrimSpace(profile.Name),
		profile.Role,
		profile.Description,
		profile.VoiceName,
		profile.PresetID,
		profile.StyleID,
		profile.AccentID,
		profile.LanguageCode,
		profile.AgeImpression,
		profile.EmotionalRange,
		profile.SampleLinesJSON,
		profile.PronunciationNotes,
		profile.MetadataJSON,
		profile.SortOrder,
		now,
		profileID,
	)
	if err != nil {
		return fmt.Errorf("update cast profile %d: %w", profileID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteCastProfile removes a cast profile after snapshotting its last state.
func (s *Store) DeleteCastProfile(profileID int64) error {
	if err := s.snapshotCastProfileVersion(profileID); err != nil {
		return err
	}
	result, err := s.db.Exec(`DELETE FROM cast_profiles WHERE id = ?`, profileID)
	if err != nil {
		return fmt.Errorf("delete cast profile %d: %w", profileID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// snapshotCastProfileVersion preserves the current profile before mutation or deletion.
func (s *Store) snapshotCastProfileVersion(profileID int64) error {
	profile, err := s.GetCastProfile(profileID)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(
		`INSERT INTO cast_profile_versions (
		     profile_id, name, role, description, voice_name, preset_id, style_id,
		     accent_id, language_code, age_impression, emotional_range,
		     sample_lines_json, pronunciation_notes, metadata_json, sort_order
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		profileID,
		profile.Name,
		profile.Role,
		profile.Description,
		profile.VoiceName,
		profile.PresetID,
		profile.StyleID,
		profile.AccentID,
		profile.LanguageCode,
		profile.AgeImpression,
		profile.EmotionalRange,
		profile.SampleLinesJSON,
		profile.PronunciationNotes,
		profile.MetadataJSON,
		profile.SortOrder,
	)
	return err
}

// ListCastProfileVersions returns newest snapshots for one profile.
func (s *Store) ListCastProfileVersions(profileID int64, limit int) ([]CastProfileVersion, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	rows, err := s.db.Query(
		`SELECT id, profile_id, name, role, description, voice_name, preset_id,
		        style_id, accent_id, language_code, age_impression, emotional_range,
		        sample_lines_json, pronunciation_notes, metadata_json, sort_order,
		        created_at
		   FROM cast_profile_versions
		  WHERE profile_id = ?
		  ORDER BY created_at DESC, id DESC
		  LIMIT ?`,
		profileID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("query cast profile versions: %w", err)
	}
	defer rows.Close()

	var versions []CastProfileVersion
	for rows.Next() {
		version, err := scanCastProfileVersion(rows)
		if err != nil {
			return nil, err
		}
		versions = append(versions, version)
	}
	return versions, rows.Err()
}

// RevertCastProfileVersion restores a cast profile to one saved snapshot.
func (s *Store) RevertCastProfileVersion(profileID, versionID int64) error {
	row := s.db.QueryRow(
		`SELECT id, profile_id, name, role, description, voice_name, preset_id,
		        style_id, accent_id, language_code, age_impression, emotional_range,
		        sample_lines_json, pronunciation_notes, metadata_json, sort_order,
		        created_at
		   FROM cast_profile_versions
		  WHERE id = ? AND profile_id = ?`,
		versionID, profileID,
	)
	version, err := scanCastProfileVersion(row)
	if err != nil {
		return fmt.Errorf("query cast profile version %d: %w", versionID, err)
	}
	if err := s.snapshotCastProfileVersion(profileID); err != nil {
		return err
	}

	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`UPDATE cast_profiles
		    SET name = ?, role = ?, description = ?, voice_name = ?, preset_id = ?,
		        style_id = ?, accent_id = ?, language_code = ?, age_impression = ?,
		        emotional_range = ?, sample_lines_json = ?, pronunciation_notes = ?,
		        metadata_json = ?, sort_order = ?, updated_at = ?
		  WHERE id = ?`,
		version.Name,
		version.Role,
		version.Description,
		version.VoiceName,
		version.PresetID,
		version.StyleID,
		version.AccentID,
		version.LanguageCode,
		version.AgeImpression,
		version.EmotionalRange,
		version.SampleLinesJSON,
		version.PronunciationNotes,
		version.MetadataJSON,
		version.SortOrder,
		now,
		profileID,
	)
	if err != nil {
		return fmt.Errorf("revert cast profile %d: %w", profileID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

type castProfileScanner interface {
	Scan(dest ...any) error
}

// scanCastProfile maps a cast_profiles row into a CastProfile.
func scanCastProfile(scanner castProfileScanner) (CastProfile, error) {
	var profile CastProfile
	if err := scanner.Scan(
		&profile.ID,
		&profile.ProjectID,
		&profile.SeriesID,
		&profile.Name,
		&profile.Role,
		&profile.Description,
		&profile.VoiceName,
		&profile.PresetID,
		&profile.StyleID,
		&profile.AccentID,
		&profile.LanguageCode,
		&profile.AgeImpression,
		&profile.EmotionalRange,
		&profile.SampleLinesJSON,
		&profile.PronunciationNotes,
		&profile.MetadataJSON,
		&profile.SortOrder,
		&profile.CreatedAt,
		&profile.UpdatedAt,
	); err != nil {
		return CastProfile{}, fmt.Errorf("scan cast profile: %w", err)
	}
	return profile, nil
}

// scanCastProfileVersion maps a cast_profile_versions row into a snapshot.
func scanCastProfileVersion(scanner castProfileScanner) (CastProfileVersion, error) {
	var version CastProfileVersion
	if err := scanner.Scan(
		&version.ID,
		&version.ProfileID,
		&version.Name,
		&version.Role,
		&version.Description,
		&version.VoiceName,
		&version.PresetID,
		&version.StyleID,
		&version.AccentID,
		&version.LanguageCode,
		&version.AgeImpression,
		&version.EmotionalRange,
		&version.SampleLinesJSON,
		&version.PronunciationNotes,
		&version.MetadataJSON,
		&version.SortOrder,
		&version.CreatedAt,
	); err != nil {
		return CastProfileVersion{}, fmt.Errorf("scan cast profile version: %w", err)
	}
	return version, nil
}
