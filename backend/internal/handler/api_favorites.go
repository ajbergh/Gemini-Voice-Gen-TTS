// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"encoding/json"
	"net/http"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// FavoritesHandler handles /api/favorites endpoints.
type FavoritesHandler struct {
	Store *store.Store
}

// ListFavorites returns all favorited voice names.
func (h *FavoritesHandler) ListFavorites(w http.ResponseWriter, r *http.Request) {
	names, err := h.Store.ListFavorites()
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	if names == nil {
		names = []string{}
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(names)
}

// ToggleFavorite adds or removes a voice from favorites.
func (h *FavoritesHandler) ToggleFavorite(w http.ResponseWriter, r *http.Request) {
	var req struct {
		VoiceName string `json:"voice_name"`
		Favorite  bool   `json:"favorite"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if req.VoiceName == "" {
		http.Error(w, "voice_name is required", http.StatusBadRequest)
		return
	}

	var err error
	if req.Favorite {
		err = h.Store.AddFavorite(req.VoiceName)
	} else {
		err = h.Store.RemoveFavorite(req.VoiceName)
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]bool{"ok": true})
}
