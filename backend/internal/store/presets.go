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
	CreatedAt         string  `json:"created_at"`
	UpdatedAt         string  `json:"updated_at"`
}

// ListCustomPresets returns all custom presets ordered by creation date.
func (s *Store) ListCustomPresets() ([]CustomPreset, error) {
	rows, err := s.db.Query(
		"SELECT id, name, voice_name, system_instruction, sample_text, audio_path, source_query, metadata_json, created_at, updated_at FROM custom_presets ORDER BY created_at DESC",
	)
	if err != nil {
		return nil, fmt.Errorf("query custom_presets: %w", err)
	}
	defer rows.Close()

	var presets []CustomPreset
	for rows.Next() {
		var p CustomPreset
		if err := rows.Scan(&p.ID, &p.Name, &p.VoiceName, &p.SystemInstruction, &p.SampleText, &p.AudioPath, &p.SourceQuery, &p.MetadataJSON, &p.CreatedAt, &p.UpdatedAt); err != nil {
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
		"SELECT id, name, voice_name, system_instruction, sample_text, audio_path, source_query, metadata_json, created_at, updated_at FROM custom_presets WHERE id = ?",
		id,
	).Scan(&p.ID, &p.Name, &p.VoiceName, &p.SystemInstruction, &p.SampleText, &p.AudioPath, &p.SourceQuery, &p.MetadataJSON, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("query custom_preset %d: %w", id, err)
	}
	return &p, nil
}

// InsertCustomPreset adds a new custom preset and returns its ID.
func (s *Store) InsertCustomPreset(p CustomPreset) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		"INSERT INTO custom_presets (name, voice_name, system_instruction, sample_text, audio_path, source_query, metadata_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
		p.Name, p.VoiceName, p.SystemInstruction, p.SampleText, p.AudioPath, p.SourceQuery, p.MetadataJSON, now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("insert custom_preset: %w", err)
	}
	return result.LastInsertId()
}

// UpdateCustomPreset updates an existing custom preset's mutable fields.
func (s *Store) UpdateCustomPreset(id int64, p CustomPreset) error {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		"UPDATE custom_presets SET name = ?, sample_text = ?, audio_path = COALESCE(?, audio_path), metadata_json = ?, updated_at = ? WHERE id = ?",
		p.Name, p.SampleText, p.AudioPath, p.MetadataJSON, now, id,
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
