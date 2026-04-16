// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_keys.go implements HTTP handlers for API key
// management (store, list, test, delete) at /api/keys.
package handler

import (
	"database/sql"
	"log/slog"
	"net/http"
	"strings"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/crypto"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/gemini"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// KeysHandler handles /api/keys endpoints.
type KeysHandler struct {
	Store     *store.Store
	CryptoKey []byte // AES-256 encryption key
}

// ListKeys returns providers that have a stored key (no plaintext).
func (h *KeysHandler) ListKeys(w http.ResponseWriter, r *http.Request) {
	keys, err := h.Store.ListAPIKeyProviders()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list keys")
		return
	}
	if keys == nil {
		keys = []store.APIKeyRow{}
	}
	writeJSON(w, http.StatusOK, keys)
}

// StoreKey encrypts and stores an API key.
func (h *KeysHandler) StoreKey(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Provider string `json:"provider"`
		Key      string `json:"key"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	body.Provider = strings.TrimSpace(body.Provider)
	body.Key = strings.TrimSpace(body.Key)

	if body.Provider == "" || body.Key == "" {
		writeError(w, http.StatusBadRequest, "provider and key are required")
		return
	}

	encrypted, nonce, err := crypto.Encrypt(h.CryptoKey, []byte(body.Key))
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to encrypt key")
		return
	}

	if err := h.Store.UpsertAPIKey(body.Provider, encrypted, nonce); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to store key")
		return
	}

	writeJSON(w, http.StatusCreated, map[string]string{"status": "stored"})
}

// DeleteKey removes an API key for a provider.
func (h *KeysHandler) DeleteKey(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if provider == "" {
		writeError(w, http.StatusBadRequest, "provider is required")
		return
	}

	if err := h.Store.DeleteAPIKey(provider); err != nil {
		writeError(w, http.StatusNotFound, "key not found")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// TestKey validates an API key by making a lightweight Gemini API call.
func (h *KeysHandler) TestKey(w http.ResponseWriter, r *http.Request) {
	provider := r.PathValue("provider")
	if provider == "" {
		writeError(w, http.StatusBadRequest, "provider is required")
		return
	}

	row, err := h.Store.GetAPIKey(provider)
	if err != nil {
		if err == sql.ErrNoRows {
			writeError(w, http.StatusNotFound, "key not found")
			return
		}
		writeError(w, http.StatusInternalServerError, "failed to retrieve key")
		return
	}

	plaintext, err := crypto.Decrypt(h.CryptoKey, row.Encrypted, row.Nonce)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to decrypt key")
		return
	}

	client := gemini.NewClient(string(plaintext))
	if err := client.TestKey(); err != nil {
		slog.Warn("API key validation failed", "error", err)
		writeJSON(w, http.StatusOK, map[string]any{"valid": false, "message": "API key validation failed. Check your key and try again."})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{"valid": true, "message": "API key is valid and working."})
}

// GetDecryptedKey is an internal helper that retrieves and decrypts the API key for a provider.
func (h *KeysHandler) GetDecryptedKey(provider string) (string, error) {
	row, err := h.Store.GetAPIKey(provider)
	if err != nil {
		return "", err
	}
	plaintext, err := crypto.Decrypt(h.CryptoKey, row.Encrypted, row.Nonce)
	if err != nil {
		return "", err
	}
	return string(plaintext), nil
}
