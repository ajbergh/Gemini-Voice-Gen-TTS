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
