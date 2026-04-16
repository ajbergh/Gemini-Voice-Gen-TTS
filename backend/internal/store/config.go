// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — config.go implements CRUD operations for the key-value
// config table. Supports single and batch upserts within a transaction.
package store

import (
	"database/sql"
	"fmt"
	"time"
)

// ConfigEntry represents a key-value config row.
type ConfigEntry struct {
	Key       string `json:"key"`
	Value     string `json:"value"`
	UpdatedAt string `json:"updated_at"`
}

// GetAllConfig returns all config entries.
func (s *Store) GetAllConfig() ([]ConfigEntry, error) {
	rows, err := s.db.Query("SELECT key, value, updated_at FROM config ORDER BY key")
	if err != nil {
		return nil, fmt.Errorf("query config: %w", err)
	}
	defer rows.Close()

	var entries []ConfigEntry
	for rows.Next() {
		var e ConfigEntry
		if err := rows.Scan(&e.Key, &e.Value, &e.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan config: %w", err)
		}
		entries = append(entries, e)
	}
	return entries, rows.Err()
}

// GetConfig returns a single config value by key.
func (s *Store) GetConfig(key string) (string, error) {
	var value string
	err := s.db.QueryRow("SELECT value FROM config WHERE key = ?", key).Scan(&value)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", fmt.Errorf("query config key %s: %w", key, err)
	}
	return value, nil
}

// SetConfig upserts a config key-value pair.
func (s *Store) SetConfig(key, value string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		`INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		key, value, now,
	)
	if err != nil {
		return fmt.Errorf("upsert config: %w", err)
	}
	return nil
}

// SetConfigBatch upserts multiple config entries in a transaction.
func (s *Store) SetConfigBatch(entries map[string]string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer tx.Rollback()

	now := time.Now().UTC().Format(time.RFC3339)
	stmt, err := tx.Prepare(
		`INSERT INTO config (key, value, updated_at) VALUES (?, ?, ?)
		 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
	)
	if err != nil {
		return fmt.Errorf("prepare stmt: %w", err)
	}
	defer stmt.Close()

	for k, v := range entries {
		if _, err := stmt.Exec(k, v, now); err != nil {
			return fmt.Errorf("exec config %s: %w", k, err)
		}
	}

	return tx.Commit()
}
