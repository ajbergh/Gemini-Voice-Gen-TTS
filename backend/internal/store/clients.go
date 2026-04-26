// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — clients.go implements persistence for client/brand workspaces
// and their linked assets.
package store

import (
	"fmt"
	"time"
)

// Client represents a client or brand voiceover workspace.
type Client struct {
	ID                     int64   `json:"id"`
	Name                   string  `json:"name"`
	Description            string  `json:"description"`
	BrandNotes             string  `json:"brand_notes"`
	DefaultProvider        *string `json:"default_provider,omitempty"`
	DefaultModel           *string `json:"default_model,omitempty"`
	FallbackProvider       *string `json:"fallback_provider,omitempty"`
	FallbackModel          *string `json:"fallback_model,omitempty"`
	DefaultVoiceName       *string `json:"default_voice_name,omitempty"`
	DefaultPresetID        *int64  `json:"default_preset_id,omitempty"`
	DefaultStyleID         *int64  `json:"default_style_id,omitempty"`
	DefaultExportProfileID *int64  `json:"default_export_profile_id,omitempty"`
	MetadataJSON           *string `json:"metadata_json,omitempty"`
	CreatedAt              string  `json:"created_at"`
	UpdatedAt              string  `json:"updated_at"`
}

// ClientAsset links a client to a reusable asset (preset, style, dict, etc.).
type ClientAsset struct {
	ID        int64  `json:"id"`
	ClientID  int64  `json:"client_id"`
	AssetType string `json:"asset_type"`
	AssetID   int64  `json:"asset_id"`
	Label     string `json:"label"`
	CreatedAt string `json:"created_at"`
}

const clientSelectCols = `id, name, description, brand_notes,
  default_provider, default_model, fallback_provider, fallback_model, default_voice_name,
  default_preset_id, default_style_id, default_export_profile_id,
  metadata_json, created_at, updated_at`

func scanClient(row interface{ Scan(...any) error }) (*Client, error) {
	c := &Client{}
	err := row.Scan(
		&c.ID, &c.Name, &c.Description, &c.BrandNotes,
		&c.DefaultProvider, &c.DefaultModel, &c.FallbackProvider, &c.FallbackModel, &c.DefaultVoiceName,
		&c.DefaultPresetID, &c.DefaultStyleID, &c.DefaultExportProfileID,
		&c.MetadataJSON, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return c, nil
}

// ListClients returns all clients ordered by name.
func (s *Store) ListClients() ([]*Client, error) {
	rows, err := s.db.Query(`SELECT ` + clientSelectCols + ` FROM clients ORDER BY name ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*Client
	for rows.Next() {
		c, err := scanClient(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

// GetClient returns a single client by ID.
func (s *Store) GetClient(id int64) (*Client, error) {
	row := s.db.QueryRow(`SELECT `+clientSelectCols+` FROM clients WHERE id = ?`, id)
	c, err := scanClient(row)
	if err != nil {
		return nil, fmt.Errorf("get client %d: %w", id, err)
	}
	return c, nil
}

// CreateClient inserts a new client record.
func (s *Store) CreateClient(c *Client) error {
	now := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	res, err := s.db.Exec(`
		INSERT INTO clients (name, description, brand_notes,
		  default_provider, default_model, fallback_provider, fallback_model, default_voice_name,
		  default_preset_id, default_style_id, default_export_profile_id,
		  metadata_json, created_at, updated_at)
		VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		c.Name, c.Description, c.BrandNotes,
		c.DefaultProvider, c.DefaultModel, c.FallbackProvider, c.FallbackModel, c.DefaultVoiceName,
		c.DefaultPresetID, c.DefaultStyleID, c.DefaultExportProfileID,
		c.MetadataJSON, now, now,
	)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	c.ID = id
	c.CreatedAt = now
	c.UpdatedAt = now
	return nil
}

// UpdateClient updates mutable fields on a client record.
func (s *Store) UpdateClient(c *Client) error {
	now := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	_, err := s.db.Exec(`
		UPDATE clients SET
		  name = ?, description = ?, brand_notes = ?,
		  default_provider = ?, default_model = ?, fallback_provider = ?, fallback_model = ?, default_voice_name = ?,
		  default_preset_id = ?, default_style_id = ?, default_export_profile_id = ?,
		  metadata_json = ?, updated_at = ?
		WHERE id = ?`,
		c.Name, c.Description, c.BrandNotes,
		c.DefaultProvider, c.DefaultModel, c.FallbackProvider, c.FallbackModel, c.DefaultVoiceName,
		c.DefaultPresetID, c.DefaultStyleID, c.DefaultExportProfileID,
		c.MetadataJSON, now, c.ID,
	)
	if err != nil {
		return err
	}
	c.UpdatedAt = now
	return nil
}

// DeleteClient removes a client and its cascaded assets.
func (s *Store) DeleteClient(id int64) error {
	_, err := s.db.Exec(`DELETE FROM clients WHERE id = ?`, id)
	return err
}

// ListClientAssets returns all assets linked to a client.
func (s *Store) ListClientAssets(clientID int64) ([]*ClientAsset, error) {
	rows, err := s.db.Query(`
		SELECT id, client_id, asset_type, asset_id, label, created_at
		FROM client_assets WHERE client_id = ? ORDER BY asset_type, id`, clientID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []*ClientAsset
	for rows.Next() {
		a := &ClientAsset{}
		if err := rows.Scan(&a.ID, &a.ClientID, &a.AssetType, &a.AssetID, &a.Label, &a.CreatedAt); err != nil {
			return nil, err
		}
		out = append(out, a)
	}
	return out, rows.Err()
}

// AddClientAsset links an asset to a client. Ignores duplicate links.
func (s *Store) AddClientAsset(a *ClientAsset) error {
	now := time.Now().UTC().Format("2006-01-02T15:04:05.000Z")
	res, err := s.db.Exec(`
		INSERT OR IGNORE INTO client_assets (client_id, asset_type, asset_id, label, created_at)
		VALUES (?,?,?,?,?)`,
		a.ClientID, a.AssetType, a.AssetID, a.Label, now,
	)
	if err != nil {
		return err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return err
	}
	a.ID = id
	a.CreatedAt = now
	return nil
}

// RemoveClientAsset unlinks a specific asset from a client.
func (s *Store) RemoveClientAsset(clientID, assetID int64) error {
	_, err := s.db.Exec(`DELETE FROM client_assets WHERE id = ? AND client_id = ?`, assetID, clientID)
	return err
}
