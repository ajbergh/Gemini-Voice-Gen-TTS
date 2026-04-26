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

// Config key constants for well-known configuration entries.
// Use these instead of raw string literals to avoid typos.
const (
	ConfigKeyDefaultModel            = "default_model"
	ConfigKeyDefaultLanguageCode     = "default_language_code"
	ConfigKeyDefaultBatchConcurrency = "default_batch_concurrency"
	ConfigKeyDefaultRetryCount       = "default_retry_count"
	ConfigKeyContinueBatchOnError    = "continue_batch_on_error"
	ConfigKeyDefaultProvider         = "default_provider"
	ConfigKeyFallbackProvider        = "fallback_provider"
	ConfigKeyFallbackModel           = "fallback_model"
	ConfigKeyLastOpenProjectID       = "last_open_project_id"
	ConfigKeyDefaultExportProfileID  = "default_export_profile_id"
	ConfigKeyQcDefaultSeverity       = "qc_default_severity"
	ConfigKeyQcAutoFlagClipping      = "qc_auto_flag_clipping"
	ConfigKeyQcClippingThresholdDb   = "qc_clipping_threshold_db"
	ConfigKeyQcExportOnlyApproved    = "qc_export_only_approved"
	ConfigKeyQcExportNotesFormat     = "qc_export_notes_format"
	ConfigKeyAppearanceTheme         = "appearance_theme"
	ConfigKeyAppearanceAccentColor   = "appearance_accent_color"
	ConfigKeyAppearanceHighContrast  = "appearance_high_contrast"
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

// GetConfigValue returns the config value for the given key, or defaultVal
// if the key is not set or an error occurs. Useful for single-key lookups
// where a sensible default is always acceptable.
func (s *Store) GetConfigValue(key, defaultVal string) string {
	v, err := s.GetConfig(key)
	if err != nil || v == "" {
		return defaultVal
	}
	return v
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
