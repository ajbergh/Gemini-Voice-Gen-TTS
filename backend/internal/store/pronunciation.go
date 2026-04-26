// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — pronunciation.go implements CRUD for pronunciation
// dictionaries and their replacement entries.
package store

import (
	"database/sql"
	"fmt"
	"time"
)

// PronunciationDictionary represents a named set of word-replacement rules
// scoped to a project.
type PronunciationDictionary struct {
	ID        int64  `json:"id"`
	ProjectID int64  `json:"project_id"`
	Scope     string `json:"scope,omitempty"`
	Name      string `json:"name"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// PronunciationEntry is one word-replacement rule within a dictionary.
type PronunciationEntry struct {
	ID           int64  `json:"id"`
	DictionaryID int64  `json:"dictionary_id"`
	RawWord      string `json:"raw_word"`
	Replacement  string `json:"replacement"`
	IsRegex      bool   `json:"is_regex"`
	Enabled      bool   `json:"enabled"`
	SortOrder    int    `json:"sort_order"`
	CreatedAt    string `json:"created_at"`
	UpdatedAt    string `json:"updated_at"`
}

// ---------------------------------------------------------------------------
// Dictionaries
// ---------------------------------------------------------------------------

// ListDictionaries returns all dictionaries for a project ordered by id.
func (s *Store) ListDictionaries(projectID int64) ([]PronunciationDictionary, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, name, created_at, updated_at
		   FROM pronunciation_dictionaries
		  WHERE project_id = ?
		  ORDER BY id`,
		projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list dictionaries: %w", err)
	}
	defer rows.Close()

	var out []PronunciationDictionary
	for rows.Next() {
		var d PronunciationDictionary
		if err := rows.Scan(&d.ID, &d.ProjectID, &d.Name, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan dictionary: %w", err)
		}
		d.Scope = "project"
		out = append(out, d)
	}
	return out, rows.Err()
}

// CreateDictionary inserts a new dictionary and returns its assigned ID.
func (s *Store) CreateDictionary(projectID int64, name string) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := s.db.Exec(
		`INSERT INTO pronunciation_dictionaries (project_id, name, created_at, updated_at)
		 VALUES (?, ?, ?, ?)`,
		projectID, name, now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("create dictionary: %w", err)
	}
	return res.LastInsertId()
}

// GetDictionary returns a single dictionary, verifying the project_id ownership.
func (s *Store) GetDictionary(projectID, dictID int64) (*PronunciationDictionary, error) {
	var d PronunciationDictionary
	err := s.db.QueryRow(
		`SELECT id, project_id, name, created_at, updated_at
		   FROM pronunciation_dictionaries
		  WHERE id = ? AND project_id = ?`,
		dictID, projectID,
	).Scan(&d.ID, &d.ProjectID, &d.Name, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, fmt.Errorf("get dictionary %d: %w", dictID, err)
	}
	d.Scope = "project"
	return &d, nil
}

// UpdateDictionary renames a dictionary.
func (s *Store) UpdateDictionary(projectID, dictID int64, name string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`UPDATE pronunciation_dictionaries SET name = ?, updated_at = ?
		  WHERE id = ? AND project_id = ?`,
		name, now, dictID, projectID,
	)
	if err != nil {
		return fmt.Errorf("update dictionary %d: %w", dictID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteDictionary deletes a dictionary and its entries (CASCADE).
func (s *Store) DeleteDictionary(projectID, dictID int64) error {
	result, err := s.db.Exec(
		`DELETE FROM pronunciation_dictionaries WHERE id = ? AND project_id = ?`,
		dictID, projectID,
	)
	if err != nil {
		return fmt.Errorf("delete dictionary %d: %w", dictID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ---------------------------------------------------------------------------
// Global dictionaries
// ---------------------------------------------------------------------------

// ListGlobalDictionaries returns all reusable global dictionaries ordered by id.
func (s *Store) ListGlobalDictionaries() ([]PronunciationDictionary, error) {
	rows, err := s.db.Query(
		`SELECT id, name, created_at, updated_at
		   FROM global_pronunciation_dictionaries
		  ORDER BY id`,
	)
	if err != nil {
		return nil, fmt.Errorf("list global dictionaries: %w", err)
	}
	defer rows.Close()

	var out []PronunciationDictionary
	for rows.Next() {
		var d PronunciationDictionary
		if err := rows.Scan(&d.ID, &d.Name, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan global dictionary: %w", err)
		}
		d.Scope = "global"
		out = append(out, d)
	}
	return out, rows.Err()
}

// CreateGlobalDictionary inserts a reusable global dictionary.
func (s *Store) CreateGlobalDictionary(name string) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := s.db.Exec(
		`INSERT INTO global_pronunciation_dictionaries (name, created_at, updated_at)
		 VALUES (?, ?, ?)`,
		name, now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("create global dictionary: %w", err)
	}
	return res.LastInsertId()
}

// GetGlobalDictionary returns a single reusable global dictionary.
func (s *Store) GetGlobalDictionary(dictID int64) (*PronunciationDictionary, error) {
	var d PronunciationDictionary
	err := s.db.QueryRow(
		`SELECT id, name, created_at, updated_at
		   FROM global_pronunciation_dictionaries
		  WHERE id = ?`,
		dictID,
	).Scan(&d.ID, &d.Name, &d.CreatedAt, &d.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, fmt.Errorf("get global dictionary %d: %w", dictID, err)
	}
	d.Scope = "global"
	return &d, nil
}

// UpdateGlobalDictionary renames a reusable global dictionary.
func (s *Store) UpdateGlobalDictionary(dictID int64, name string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`UPDATE global_pronunciation_dictionaries SET name = ?, updated_at = ?
		  WHERE id = ?`,
		name, now, dictID,
	)
	if err != nil {
		return fmt.Errorf("update global dictionary %d: %w", dictID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteGlobalDictionary deletes a reusable global dictionary and its entries.
func (s *Store) DeleteGlobalDictionary(dictID int64) error {
	result, err := s.db.Exec(
		`DELETE FROM global_pronunciation_dictionaries WHERE id = ?`,
		dictID,
	)
	if err != nil {
		return fmt.Errorf("delete global dictionary %d: %w", dictID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

// ListEntries returns all entries for a dictionary ordered by sort_order, id.
func (s *Store) ListEntries(dictID int64) ([]PronunciationEntry, error) {
	rows, err := s.db.Query(
		`SELECT id, dictionary_id, raw_word, replacement, is_regex, enabled, sort_order, created_at, updated_at
		   FROM pronunciation_entries
		  WHERE dictionary_id = ?
		  ORDER BY sort_order, id`,
		dictID,
	)
	if err != nil {
		return nil, fmt.Errorf("list entries: %w", err)
	}
	defer rows.Close()

	var out []PronunciationEntry
	for rows.Next() {
		var e PronunciationEntry
		var isRegex, enabled int
		if err := rows.Scan(&e.ID, &e.DictionaryID, &e.RawWord, &e.Replacement,
			&isRegex, &enabled, &e.SortOrder, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan entry: %w", err)
		}
		e.IsRegex = isRegex == 1
		e.Enabled = enabled == 1
		out = append(out, e)
	}
	return out, rows.Err()
}

// CreateEntry inserts a new pronunciation entry and returns its ID.
func (s *Store) CreateEntry(e PronunciationEntry) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	isRegex := boolToInt(e.IsRegex)
	enabled := boolToInt(e.Enabled)
	res, err := s.db.Exec(
		`INSERT INTO pronunciation_entries
		   (dictionary_id, raw_word, replacement, is_regex, enabled, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		e.DictionaryID, e.RawWord, e.Replacement, isRegex, enabled, e.SortOrder, now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("create entry: %w", err)
	}
	return res.LastInsertId()
}

// GetEntry returns a single entry verifying dictionary ownership.
func (s *Store) GetEntry(dictID, entryID int64) (*PronunciationEntry, error) {
	var e PronunciationEntry
	var isRegex, enabled int
	err := s.db.QueryRow(
		`SELECT id, dictionary_id, raw_word, replacement, is_regex, enabled, sort_order, created_at, updated_at
		   FROM pronunciation_entries
		  WHERE id = ? AND dictionary_id = ?`,
		entryID, dictID,
	).Scan(&e.ID, &e.DictionaryID, &e.RawWord, &e.Replacement,
		&isRegex, &enabled, &e.SortOrder, &e.CreatedAt, &e.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, fmt.Errorf("get entry %d: %w", entryID, err)
	}
	e.IsRegex = isRegex == 1
	e.Enabled = enabled == 1
	return &e, nil
}

// UpdateEntry updates an existing pronunciation entry.
func (s *Store) UpdateEntry(e PronunciationEntry) error {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`UPDATE pronunciation_entries
		    SET raw_word = ?, replacement = ?, is_regex = ?, enabled = ?, sort_order = ?, updated_at = ?
		  WHERE id = ? AND dictionary_id = ?`,
		e.RawWord, e.Replacement, boolToInt(e.IsRegex), boolToInt(e.Enabled),
		e.SortOrder, now, e.ID, e.DictionaryID,
	)
	if err != nil {
		return fmt.Errorf("update entry %d: %w", e.ID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteEntry deletes a single pronunciation entry.
func (s *Store) DeleteEntry(dictID, entryID int64) error {
	result, err := s.db.Exec(
		`DELETE FROM pronunciation_entries WHERE id = ? AND dictionary_id = ?`,
		entryID, dictID,
	)
	if err != nil {
		return fmt.Errorf("delete entry %d: %w", entryID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ListGlobalEntries returns all entries for a reusable global dictionary.
func (s *Store) ListGlobalEntries(dictID int64) ([]PronunciationEntry, error) {
	rows, err := s.db.Query(
		`SELECT id, dictionary_id, raw_word, replacement, is_regex, enabled, sort_order, created_at, updated_at
		   FROM global_pronunciation_entries
		  WHERE dictionary_id = ?
		  ORDER BY sort_order, id`,
		dictID,
	)
	if err != nil {
		return nil, fmt.Errorf("list global entries: %w", err)
	}
	defer rows.Close()

	var out []PronunciationEntry
	for rows.Next() {
		var e PronunciationEntry
		var isRegex, enabled int
		if err := rows.Scan(&e.ID, &e.DictionaryID, &e.RawWord, &e.Replacement,
			&isRegex, &enabled, &e.SortOrder, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan global entry: %w", err)
		}
		e.IsRegex = isRegex == 1
		e.Enabled = enabled == 1
		out = append(out, e)
	}
	return out, rows.Err()
}

// CreateGlobalEntry inserts a new reusable global pronunciation entry.
func (s *Store) CreateGlobalEntry(e PronunciationEntry) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	res, err := s.db.Exec(
		`INSERT INTO global_pronunciation_entries
		   (dictionary_id, raw_word, replacement, is_regex, enabled, sort_order, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		e.DictionaryID, e.RawWord, e.Replacement, boolToInt(e.IsRegex), boolToInt(e.Enabled), e.SortOrder, now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("create global entry: %w", err)
	}
	return res.LastInsertId()
}

// GetGlobalEntry returns a single reusable global pronunciation entry.
func (s *Store) GetGlobalEntry(dictID, entryID int64) (*PronunciationEntry, error) {
	var e PronunciationEntry
	var isRegex, enabled int
	err := s.db.QueryRow(
		`SELECT id, dictionary_id, raw_word, replacement, is_regex, enabled, sort_order, created_at, updated_at
		   FROM global_pronunciation_entries
		  WHERE id = ? AND dictionary_id = ?`,
		entryID, dictID,
	).Scan(&e.ID, &e.DictionaryID, &e.RawWord, &e.Replacement,
		&isRegex, &enabled, &e.SortOrder, &e.CreatedAt, &e.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, sql.ErrNoRows
	}
	if err != nil {
		return nil, fmt.Errorf("get global entry %d: %w", entryID, err)
	}
	e.IsRegex = isRegex == 1
	e.Enabled = enabled == 1
	return &e, nil
}

// UpdateGlobalEntry updates an existing reusable global pronunciation entry.
func (s *Store) UpdateGlobalEntry(e PronunciationEntry) error {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`UPDATE global_pronunciation_entries
		    SET raw_word = ?, replacement = ?, is_regex = ?, enabled = ?, sort_order = ?, updated_at = ?
		  WHERE id = ? AND dictionary_id = ?`,
		e.RawWord, e.Replacement, boolToInt(e.IsRegex), boolToInt(e.Enabled),
		e.SortOrder, now, e.ID, e.DictionaryID,
	)
	if err != nil {
		return fmt.Errorf("update global entry %d: %w", e.ID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteGlobalEntry deletes a reusable global pronunciation entry.
func (s *Store) DeleteGlobalEntry(dictID, entryID int64) error {
	result, err := s.db.Exec(
		`DELETE FROM global_pronunciation_entries WHERE id = ? AND dictionary_id = ?`,
		entryID, dictID,
	)
	if err != nil {
		return fmt.Errorf("delete global entry %d: %w", entryID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ListEnabledEntriesForProject returns enabled global entries followed by
// enabled project-scoped entries. Used by the render pipeline.
func (s *Store) ListEnabledEntriesForProject(projectID int64) ([]PronunciationEntry, error) {
	globalRows, err := s.db.Query(
		`SELECT e.id, e.dictionary_id, e.raw_word, e.replacement,
		        e.is_regex, e.enabled, e.sort_order, e.created_at, e.updated_at
		   FROM global_pronunciation_entries e
		   JOIN global_pronunciation_dictionaries d ON d.id = e.dictionary_id
		  WHERE e.enabled = 1
		  ORDER BY d.id, e.sort_order, e.id`,
	)
	if err != nil {
		return nil, fmt.Errorf("list enabled global entries: %w", err)
	}
	defer globalRows.Close()

	var out []PronunciationEntry
	for globalRows.Next() {
		var e PronunciationEntry
		var isRegex, enabled int
		if err := globalRows.Scan(&e.ID, &e.DictionaryID, &e.RawWord, &e.Replacement,
			&isRegex, &enabled, &e.SortOrder, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan enabled global entry: %w", err)
		}
		e.IsRegex = isRegex == 1
		e.Enabled = enabled == 1
		out = append(out, e)
	}
	if err := globalRows.Err(); err != nil {
		return nil, err
	}

	rows, err := s.db.Query(
		`SELECT e.id, e.dictionary_id, e.raw_word, e.replacement,
		        e.is_regex, e.enabled, e.sort_order, e.created_at, e.updated_at
		   FROM pronunciation_entries e
		   JOIN pronunciation_dictionaries d ON d.id = e.dictionary_id
		  WHERE d.project_id = ? AND e.enabled = 1
		  ORDER BY d.id, e.sort_order, e.id`,
		projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("list enabled entries: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var e PronunciationEntry
		var isRegex, enabled int
		if err := rows.Scan(&e.ID, &e.DictionaryID, &e.RawWord, &e.Replacement,
			&isRegex, &enabled, &e.SortOrder, &e.CreatedAt, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan enabled entry: %w", err)
		}
		e.IsRegex = isRegex == 1
		e.Enabled = enabled == 1
		out = append(out, e)
	}
	return out, rows.Err()
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
