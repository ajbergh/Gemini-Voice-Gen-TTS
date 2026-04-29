// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_clients.go implements client/brand workspace endpoints.
package handler

import (
	"database/sql"
	"errors"
	"net/http"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// ClientHandler handles client workspace CRUD and asset linking endpoints.
type ClientHandler struct {
	Store *store.Store
}

// ListClients returns all clients ordered by name.
//
// GET /api/clients
func (h *ClientHandler) ListClients(w http.ResponseWriter, r *http.Request) {
	list, err := h.Store.ListClients()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list clients")
		return
	}
	if list == nil {
		list = []*store.Client{}
	}
	writeJSON(w, http.StatusOK, list)
}

// CreateClient creates a new client workspace record.
//
// POST /api/clients
func (h *ClientHandler) CreateClient(w http.ResponseWriter, r *http.Request) {
	var c store.Client
	if err := decodeJSON(r, &c); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if c.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.Store.CreateClient(&c); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create client")
		return
	}
	writeJSON(w, http.StatusCreated, &c)
}

// GetClient returns a single client by ID.
//
// GET /api/clients/{id}
func (h *ClientHandler) GetClient(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePathInt64(w, r, "id", "invalid client ID")
	if !ok {
		return
	}
	c, err := h.Store.GetClient(id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "client not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get client")
		return
	}
	writeJSON(w, http.StatusOK, c)
}

// UpdateClient updates mutable fields on a client record.
//
// PUT /api/clients/{id}
func (h *ClientHandler) UpdateClient(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePathInt64(w, r, "id", "invalid client ID")
	if !ok {
		return
	}
	existing, err := h.Store.GetClient(id)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "client not found")
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to get client")
		return
	}
	if err := decodeJSON(r, existing); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	existing.ID = id
	if existing.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.Store.UpdateClient(existing); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to update client")
		return
	}
	writeJSON(w, http.StatusOK, existing)
}

// DeleteClient deletes a client and its cascaded assets.
//
// DELETE /api/clients/{id}
func (h *ClientHandler) DeleteClient(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePathInt64(w, r, "id", "invalid client ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteClient(id); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to delete client")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListClientAssets returns all assets linked to a client.
//
// GET /api/clients/{id}/assets
func (h *ClientHandler) ListClientAssets(w http.ResponseWriter, r *http.Request) {
	id, ok := parsePathInt64(w, r, "id", "invalid client ID")
	if !ok {
		return
	}
	assets, err := h.Store.ListClientAssets(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list assets")
		return
	}
	if assets == nil {
		assets = []*store.ClientAsset{}
	}
	writeJSON(w, http.StatusOK, assets)
}

// AddClientAsset links an asset to a client.
//
// POST /api/clients/{id}/assets
func (h *ClientHandler) AddClientAsset(w http.ResponseWriter, r *http.Request) {
	clientID, ok := parsePathInt64(w, r, "id", "invalid client ID")
	if !ok {
		return
	}
	var a store.ClientAsset
	if err := decodeJSON(r, &a); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if a.AssetType == "" || a.AssetID <= 0 {
		writeError(w, http.StatusBadRequest, "asset_type and asset_id are required")
		return
	}
	a.ClientID = clientID
	if err := h.Store.AddClientAsset(&a); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to add asset")
		return
	}
	writeJSON(w, http.StatusCreated, &a)
}

// RemoveClientAsset unlinks a specific asset from a client.
//
// DELETE /api/clients/{id}/assets/{assetId}
func (h *ClientHandler) RemoveClientAsset(w http.ResponseWriter, r *http.Request) {
	clientID, ok := parsePathInt64(w, r, "id", "invalid client ID")
	if !ok {
		return
	}
	assetID, ok := parsePathInt64(w, r, "assetId", "invalid asset ID")
	if !ok {
		return
	}
	if err := h.Store.RemoveClientAsset(clientID, assetID); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to remove asset")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
