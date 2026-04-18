// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — history.go implements CRUD operations for the history
// table, which records TTS generations and AI recommendation requests.
package store

import (
	"fmt"
)

// HistoryEntry represents a TTS or recommendation history row.
type HistoryEntry struct {
	ID         int64   `json:"id"`
	Type       string  `json:"type"`
	VoiceName  *string `json:"voice_name,omitempty"`
	InputText  string  `json:"input_text"`
	ResultJSON *string `json:"result_json,omitempty"`
	AudioPath  *string `json:"audio_path,omitempty"`
	CreatedAt  string  `json:"created_at"`
}

// HistoryFilter holds optional filters for listing history entries.
type HistoryFilter struct {
	Type     string // "tts" or "recommendation" or "" for all
	Query    string // Full-text search in input_text and voice_name
	Voice    string // Filter by voice_name
	DateFrom string // ISO date string (>=)
	DateTo   string // ISO date string (<=)
	Limit    int
	Offset   int
}

// ListHistory returns history entries with optional filters and pagination.
func (s *Store) ListHistory(f HistoryFilter) ([]HistoryEntry, error) {
	query := "SELECT id, type, voice_name, input_text, result_json, audio_path, created_at FROM history WHERE 1=1"
	args := []interface{}{}

	if f.Type != "" {
		query += " AND type = ?"
		args = append(args, f.Type)
	}
	if f.Query != "" {
		query += " AND (input_text LIKE ? OR voice_name LIKE ?)"
		like := "%" + f.Query + "%"
		args = append(args, like, like)
	}
	if f.Voice != "" {
		query += " AND voice_name = ?"
		args = append(args, f.Voice)
	}
	if f.DateFrom != "" {
		query += " AND created_at >= ?"
		args = append(args, f.DateFrom)
	}
	if f.DateTo != "" {
		query += " AND created_at <= ?"
		args = append(args, f.DateTo)
	}

	query += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
	args = append(args, f.Limit, f.Offset)

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("query history: %w", err)
	}
	defer rows.Close()

	var entries []HistoryEntry
	for rows.Next() {
		var e HistoryEntry
		if err := rows.Scan(&e.ID, &e.Type, &e.VoiceName, &e.InputText, &e.ResultJSON, &e.AudioPath, &e.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan history: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// GetHistoryEntry returns a single history entry by ID.
func (s *Store) GetHistoryEntry(id int64) (*HistoryEntry, error) {
	var e HistoryEntry
	err := s.db.QueryRow(
		"SELECT id, type, voice_name, input_text, result_json, audio_path, created_at FROM history WHERE id = ?",
		id,
	).Scan(&e.ID, &e.Type, &e.VoiceName, &e.InputText, &e.ResultJSON, &e.AudioPath, &e.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("query history %d: %w", id, err)
	}
	return &e, nil
}

// InsertHistory adds a new history entry.
func (s *Store) InsertHistory(entry HistoryEntry) (int64, error) {
	result, err := s.db.Exec(
		"INSERT INTO history (type, voice_name, input_text, result_json, audio_path) VALUES (?, ?, ?, ?, ?)",
		entry.Type, entry.VoiceName, entry.InputText, entry.ResultJSON, entry.AudioPath,
	)
	if err != nil {
		return 0, fmt.Errorf("insert history: %w", err)
	}
	return result.LastInsertId()
}

// DeleteHistoryEntry removes a single history entry by ID.
func (s *Store) DeleteHistoryEntry(id int64) error {
	result, err := s.db.Exec("DELETE FROM history WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete history %d: %w", id, err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("history entry %d not found", id)
	}
	return nil
}

// ClearHistory removes all history entries.
func (s *Store) ClearHistory() error {
	_, err := s.db.Exec("DELETE FROM history")
	if err != nil {
		return fmt.Errorf("clear history: %w", err)
	}
	return nil
}
