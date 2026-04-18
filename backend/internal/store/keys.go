// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — keys.go implements CRUD operations for the api_keys
// table. Key values are stored encrypted (AES-256-GCM); this layer only
// handles the ciphertext and nonce blobs.
package store

import (
	"fmt"
	"time"
)

// APIKeyRow represents a stored encrypted API key.
type APIKeyRow struct {
	ID        int64  `json:"id"`
	Provider  string `json:"provider"`
	Encrypted []byte `json:"-"`
	Nonce     []byte `json:"-"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// ListAPIKeyProviders returns all providers that have a stored key (no plaintext).
func (s *Store) ListAPIKeyProviders() ([]APIKeyRow, error) {
	rows, err := s.db.Query("SELECT id, provider, created_at, updated_at FROM api_keys ORDER BY provider")
	if err != nil {
		return nil, fmt.Errorf("query api_keys: %w", err)
	}
	defer rows.Close()

	var keys []APIKeyRow
	for rows.Next() {
		var k APIKeyRow
		if err := rows.Scan(&k.ID, &k.Provider, &k.CreatedAt, &k.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan api_key: %w", err)
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

// GetAPIKey returns the encrypted key row for a provider.
func (s *Store) GetAPIKey(provider string) (*APIKeyRow, error) {
	var k APIKeyRow
	err := s.db.QueryRow(
		"SELECT id, provider, encrypted, nonce, created_at, updated_at FROM api_keys WHERE provider = ?",
		provider,
	).Scan(&k.ID, &k.Provider, &k.Encrypted, &k.Nonce, &k.CreatedAt, &k.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("query api_key %s: %w", provider, err)
	}
	return &k, nil
}

// UpsertAPIKey stores or updates an encrypted API key for a provider.
func (s *Store) UpsertAPIKey(provider string, encrypted, nonce []byte) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		`INSERT INTO api_keys (provider, encrypted, nonce, created_at, updated_at) VALUES (?, ?, ?, ?, ?)
		 ON CONFLICT(provider) DO UPDATE SET encrypted = excluded.encrypted, nonce = excluded.nonce, updated_at = excluded.updated_at`,
		provider, encrypted, nonce, now, now,
	)
	if err != nil {
		return fmt.Errorf("upsert api_key: %w", err)
	}
	return nil
}

// DeleteAPIKey removes an API key for a provider.
func (s *Store) DeleteAPIKey(provider string) error {
	result, err := s.db.Exec("DELETE FROM api_keys WHERE provider = ?", provider)
	if err != nil {
		return fmt.Errorf("delete api_key: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("api key for provider %q not found", provider)
	}
	return nil
}

// --- API Key Pool (multiple keys per provider for rotation) ---

// APIKeyPoolRow represents a key in the rotation pool.
type APIKeyPoolRow struct {
	ID         int64  `json:"id"`
	Provider   string `json:"provider"`
	Label      string `json:"label"`
	Encrypted  []byte `json:"-"`
	Nonce      []byte `json:"-"`
	IsActive   bool   `json:"is_active"`
	ErrorCount int    `json:"error_count"`
	LastUsedAt string `json:"last_used_at,omitempty"`
	CreatedAt  string `json:"created_at"`
	UpdatedAt  string `json:"updated_at"`
}

// ListAPIKeyPool returns all keys in the pool for a provider.
func (s *Store) ListAPIKeyPool(provider string) ([]APIKeyPoolRow, error) {
	rows, err := s.db.Query(
		"SELECT id, provider, label, is_active, error_count, COALESCE(last_used_at,''), created_at, updated_at FROM api_key_pool WHERE provider = ? ORDER BY id",
		provider,
	)
	if err != nil {
		return nil, fmt.Errorf("query api_key_pool: %w", err)
	}
	defer rows.Close()

	var keys []APIKeyPoolRow
	for rows.Next() {
		var k APIKeyPoolRow
		if err := rows.Scan(&k.ID, &k.Provider, &k.Label, &k.IsActive, &k.ErrorCount, &k.LastUsedAt, &k.CreatedAt, &k.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan api_key_pool: %w", err)
		}
		keys = append(keys, k)
	}
	return keys, rows.Err()
}

// AddAPIKeyToPool adds a new key to the rotation pool.
func (s *Store) AddAPIKeyToPool(provider, label string, encrypted, nonce []byte) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`INSERT INTO api_key_pool (provider, label, encrypted, nonce, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
		provider, label, encrypted, nonce, now, now,
	)
	if err != nil {
		return 0, fmt.Errorf("insert api_key_pool: %w", err)
	}
	return result.LastInsertId()
}

// DeleteAPIKeyFromPool removes a key from the pool.
func (s *Store) DeleteAPIKeyFromPool(id int64) error {
	result, err := s.db.Exec("DELETE FROM api_key_pool WHERE id = ?", id)
	if err != nil {
		return fmt.Errorf("delete api_key_pool: %w", err)
	}
	n, _ := result.RowsAffected()
	if n == 0 {
		return fmt.Errorf("pool key %d not found", id)
	}
	return nil
}

// GetNextPoolKey returns the next active key from the pool using round-robin
// (least recently used). Returns nil if no active pool keys exist.
func (s *Store) GetNextPoolKey(provider string) (*APIKeyPoolRow, error) {
	var k APIKeyPoolRow
	err := s.db.QueryRow(
		`SELECT id, provider, label, encrypted, nonce, is_active, error_count, COALESCE(last_used_at,''), created_at, updated_at
		 FROM api_key_pool
		 WHERE provider = ? AND is_active = 1
		 ORDER BY last_used_at ASC NULLS FIRST, id ASC
		 LIMIT 1`,
		provider,
	).Scan(&k.ID, &k.Provider, &k.Label, &k.Encrypted, &k.Nonce, &k.IsActive, &k.ErrorCount, &k.LastUsedAt, &k.CreatedAt, &k.UpdatedAt)
	if err != nil {
		return nil, err // sql.ErrNoRows when pool is empty
	}

	// Mark as used
	now := time.Now().UTC().Format(time.RFC3339)
	s.db.Exec("UPDATE api_key_pool SET last_used_at = ?, updated_at = ? WHERE id = ?", now, now, k.ID)

	return &k, nil
}

// MarkPoolKeyError increments the error count and deactivates if threshold reached.
func (s *Store) MarkPoolKeyError(id int64) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		`UPDATE api_key_pool SET error_count = error_count + 1,
		 is_active = CASE WHEN error_count + 1 >= 5 THEN 0 ELSE 1 END,
		 updated_at = ? WHERE id = ?`,
		now, id,
	)
	return err
}

// ResetPoolKeyErrors resets error count and reactivates a pool key.
func (s *Store) ResetPoolKeyErrors(id int64) error {
	now := time.Now().UTC().Format(time.RFC3339)
	_, err := s.db.Exec(
		`UPDATE api_key_pool SET error_count = 0, is_active = 1, updated_at = ? WHERE id = ?`,
		now, id,
	)
	return err
}
