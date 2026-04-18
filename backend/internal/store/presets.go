// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — presets.go implements CRUD operations for the custom_presets
// table, which stores user-saved voice presets from AI recommendations.
package store

import (
	"fmt"
	"time"
)

// CustomPreset represents a user-saved voice preset.
type CustomPreset struct {
	ID                int64   `json:"id"`
	Name              string  `json:"name"`
	VoiceName         string  `json:"voice_name"`
	SystemInstruction *string `json:"system_instruction,omitempty"`
	SampleText        *string `json:"sample_text,omitempty"`
	AudioPath         *string `json:"audio_path,omitempty"`
	SourceQuery       *string `json:"source_query,omitempty"`
	MetadataJSON      *string `json:"metadata_json,omitempty"`
	Color             string  `json:"color"`
	SortOrder         int     `json:"sort_order"`
	CreatedAt         string  `json:"created_at"`
	UpdatedAt         string  `json:"updated_at"`
}

// ListCustomPresets returns all custom presets ordered by sort order then creation date.
func (s *Store) ListCustomPresets() ([]CustomPreset, error) {
	rows, err := s.db.Query(
		"SELECT id, name, voice_name, system_instruction, sample_text, audio_path, source_query, metadata_json, color, sort_order, created_at, updated_at FROM custom_presets ORDER BY sort_order ASC, created_at DESC",
	)
	if err != nil {
		return nil, fmt.Errorf("query custom_presets: %w", err)
	}
	defer rows.Close()

	var presets []CustomPreset
	for rows.Next() {
		var p CustomPreset
		if err := rows.Scan(&p.ID, &p.Name, &p.VoiceName, &p.SystemInstruction, &p.SampleText, &p.AudioPath, &p.SourceQuery, &p.MetadataJSON, &p.Color, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan custom_preset: %w", err)
		}
		presets = append(presets, p)
	}
	return presets, rows.Err()
}

// GetCustomPreset returns a single custom preset by ID.
func (s *Store) GetCustomPreset(id int64) (*CustomPreset, error) {
	var p CustomPreset
	err := s.db.QueryRow(
		"SELECT id, name, voice_name, system_instruction, sample_text, audio_path, source_query, metadata_json, color, sort_order, created_at, updated_at FROM custom_presets WHERE id = ?",
		id,
	).Scan(&p.ID, &p.Name, &p.VoiceName, &p.SystemInstruction, &p.SampleText, &p.AudioPath, &p.SourceQuery, &p.MetadataJSON, &p.Color, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("query custom_preset %d: %w", id, err)
	}
	return &p, nil
}

// InsertCustomPreset adds a new custom preset and returns its ID.
func (s *Store) InsertCustomPreset(p CustomPreset) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	color := p.Color
	if color == "" {
		color = "#6366f1"
	}
	result, err := s.db.Exec(
		"INSERT INTO custom_presets (name, voice_name, system_instruction, sample_text, audio_path, source_query, metadata_json, color, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		p.Name, p.VoiceName, p.SystemInstruction, p.SampleText, p.AudioPath, p.SourceQuery, p.MetadataJSON, color, now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("insert custom_preset: %w", err)
	}
	return result.LastInsertId()
}

// UpdateCustomPreset updates an existing custom preset's mutable fields.
// A snapshot of the current state is saved to preset_versions before updating.
func (s *Store) UpdateCustomPreset(id int64, p CustomPreset) error {
	// Snapshot current state before update
	_ = s.snapshotPresetVersion(id)

	now := time.Now().UTC().Format(time.RFC3339)
	color := p.Color
	if color == "" {
		color = "#6366f1"
	}
	result, err := s.db.Exec(
		"UPDATE custom_presets SET name = ?, sample_text = ?, audio_path = COALESCE(?, audio_path), metadata_json = ?, color = ?, updated_at = ? WHERE id = ?",
		p.Name, p.SampleText, p.AudioPath, p.MetadataJSON, color, now, id,
	)
	if err != nil {
		return fmt.Errorf("update custom_preset %d: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("custom_preset %d not found", id)
	}
	return nil
}

// DeleteCustomPreset removes a custom preset by ID.
func (s *Store) DeleteCustomPreset(id int64) error {
	result, err := s.db.Exec("DELETE FROM custom_presets WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete custom_preset %d: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("custom_preset %d not found", id)
	}
	return nil
}

// ReorderPresets updates the sort_order for each preset ID in the given order.
func (s *Store) ReorderPresets(orderedIDs []int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare("UPDATE custom_presets SET sort_order = ? WHERE id = ?")
	if err != nil {
		return fmt.Errorf("prepare reorder: %w", err)
	}
	defer stmt.Close()

	for i, id := range orderedIDs {
		if _, err := stmt.Exec(i, id); err != nil {
			return fmt.Errorf("reorder preset %d: %w", id, err)
		}
	}

	return tx.Commit()
}

// PresetVersion represents a historical snapshot of a preset.
type PresetVersion struct {
	ID                int64   `json:"id"`
	PresetID          int64   `json:"preset_id"`
	Name              string  `json:"name"`
	VoiceName         string  `json:"voice_name"`
	SystemInstruction string  `json:"system_instruction"`
	SampleText        string  `json:"sample_text"`
	Color             string  `json:"color"`
	MetadataJSON      *string `json:"metadata_json,omitempty"`
	CreatedAt         string  `json:"created_at"`
}

// snapshotPresetVersion saves the current state of a preset to preset_versions.
func (s *Store) snapshotPresetVersion(presetID int64) error {
	p, err := s.GetCustomPreset(presetID)
	if err != nil {
		return err
	}
	si := ""
	if p.SystemInstruction != nil {
		si = *p.SystemInstruction
	}
	st := ""
	if p.SampleText != nil {
		st = *p.SampleText
	}
	_, err = s.db.Exec(
		"INSERT INTO preset_versions (preset_id, name, voice_name, system_instruction, sample_text, color, metadata_json) VALUES (?, ?, ?, ?, ?, ?, ?)",
		presetID, p.Name, p.VoiceName, si, st, p.Color, p.MetadataJSON,
	)
	return err
}

// ListPresetVersions returns all version history for a preset, newest first.
func (s *Store) ListPresetVersions(presetID int64, limit int) ([]PresetVersion, error) {
	if limit <= 0 || limit > 50 {
		limit = 20
	}
	rows, err := s.db.Query(
		"SELECT id, preset_id, name, voice_name, system_instruction, sample_text, color, metadata_json, created_at FROM preset_versions WHERE preset_id = ? ORDER BY created_at DESC LIMIT ?",
		presetID, limit,
	)
	if err != nil {
		return nil, fmt.Errorf("query preset_versions: %w", err)
	}
	defer rows.Close()

	var versions []PresetVersion
	for rows.Next() {
		var v PresetVersion
		if err := rows.Scan(&v.ID, &v.PresetID, &v.Name, &v.VoiceName, &v.SystemInstruction, &v.SampleText, &v.Color, &v.MetadataJSON, &v.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan preset_version: %w", err)
		}
		versions = append(versions, v)
	}
	return versions, rows.Err()
}

// RevertPresetVersion restores a preset to a specific version snapshot.
func (s *Store) RevertPresetVersion(presetID, versionID int64) error {
	var v PresetVersion
	err := s.db.QueryRow(
		"SELECT id, preset_id, name, voice_name, system_instruction, sample_text, color, metadata_json FROM preset_versions WHERE id = ? AND preset_id = ?",
		versionID, presetID,
	).Scan(&v.ID, &v.PresetID, &v.Name, &v.VoiceName, &v.SystemInstruction, &v.SampleText, &v.Color, &v.MetadataJSON)
	if err != nil {
		return fmt.Errorf("version %d not found for preset %d: %w", versionID, presetID, err)
	}

	// Snapshot current state before reverting
	_ = s.snapshotPresetVersion(presetID)

	now := time.Now().UTC().Format(time.RFC3339)
	_, err = s.db.Exec(
		"UPDATE custom_presets SET name = ?, system_instruction = ?, sample_text = ?, color = ?, metadata_json = ?, updated_at = ? WHERE id = ?",
		v.Name, v.SystemInstruction, v.SampleText, v.Color, v.MetadataJSON, now, presetID,
	)
	return err
}
