// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — tags.go implements CRUD operations for the preset_tags table.
package store

import "fmt"

// PresetTag represents a tag attached to a custom preset.
type PresetTag struct {
	ID       int64  `json:"id"`
	PresetID int64  `json:"preset_id"`
	Tag      string `json:"tag"`
	Color    string `json:"color"`
}

// ListTagsForPreset returns all tags for a given preset ID.
func (s *Store) ListTagsForPreset(presetID int64) ([]PresetTag, error) {
	rows, err := s.db.Query("SELECT id, preset_id, tag, color FROM preset_tags WHERE preset_id = ? ORDER BY tag", presetID)
	if err != nil {
		return nil, fmt.Errorf("query preset_tags for preset %d: %w", presetID, err)
	}
	defer rows.Close()

	var tags []PresetTag
	for rows.Next() {
		var t PresetTag
		if err := rows.Scan(&t.ID, &t.PresetID, &t.Tag, &t.Color); err != nil {
			return nil, fmt.Errorf("scan preset_tag: %w", err)
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

// ListAllTags returns all distinct tags across all presets (for filter dropdowns).
func (s *Store) ListAllTags() ([]PresetTag, error) {
	rows, err := s.db.Query("SELECT DISTINCT tag, color FROM preset_tags ORDER BY tag")
	if err != nil {
		return nil, fmt.Errorf("query distinct tags: %w", err)
	}
	defer rows.Close()

	var tags []PresetTag
	for rows.Next() {
		var t PresetTag
		if err := rows.Scan(&t.Tag, &t.Color); err != nil {
			return nil, fmt.Errorf("scan distinct tag: %w", err)
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

// SetPresetTags replaces all tags for a preset with the given set.
func (s *Store) SetPresetTags(presetID int64, tags []PresetTag) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec("DELETE FROM preset_tags WHERE preset_id = ?", presetID); err != nil {
		return fmt.Errorf("delete old tags for preset %d: %w", presetID, err)
	}

	for _, t := range tags {
		if _, err := tx.Exec("INSERT INTO preset_tags (preset_id, tag, color) VALUES (?, ?, ?)", presetID, t.Tag, t.Color); err != nil {
			return fmt.Errorf("insert tag %q for preset %d: %w", t.Tag, presetID, err)
		}
	}

	return tx.Commit()
}

// DeletePresetTags removes all tags for a preset (used when deleting a preset).
func (s *Store) DeletePresetTags(presetID int64) error {
	_, err := s.db.Exec("DELETE FROM preset_tags WHERE preset_id = ?", presetID)
	if err != nil {
		return fmt.Errorf("delete tags for preset %d: %w", presetID, err)
	}
	return nil
}
