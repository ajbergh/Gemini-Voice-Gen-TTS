// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package server — routes.go registers all API routes using Go 1.22+
// method+path pattern matching on the standard net/http ServeMux.
package server

import (
	"net/http"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/handler"
)

// RegisterRoutes configures all API routes on the given mux.
func RegisterRoutes(mux *http.ServeMux, configH *handler.ConfigHandler, keysH *handler.KeysHandler, historyH *handler.HistoryHandler, voicesH *handler.VoicesHandler, presetsH *handler.PresetsHandler) {
	// Health
	mux.HandleFunc("GET /api/health", handler.Health)

	// Config
	mux.HandleFunc("GET /api/config", configH.GetConfig)
	mux.HandleFunc("PUT /api/config", configH.UpdateConfig)

	// API Keys
	mux.HandleFunc("GET /api/keys", keysH.ListKeys)
	mux.HandleFunc("POST /api/keys", keysH.StoreKey)
	mux.HandleFunc("DELETE /api/keys/{provider}", keysH.DeleteKey)
	mux.HandleFunc("GET /api/keys/{provider}/test", keysH.TestKey)

	// History
	mux.HandleFunc("GET /api/history", historyH.ListHistory)
	mux.HandleFunc("GET /api/history/{id}", historyH.GetHistoryEntry)
	mux.HandleFunc("GET /api/history/{id}/audio", historyH.GetHistoryAudio)
	mux.HandleFunc("DELETE /api/history/{id}", historyH.DeleteHistoryEntry)
	mux.HandleFunc("DELETE /api/history", historyH.ClearHistory)

	// Voices / Gemini Proxy
	mux.HandleFunc("GET /api/voices", voicesH.ListVoices)
	mux.HandleFunc("POST /api/voices/recommend", voicesH.Recommend)
	mux.HandleFunc("POST /api/voices/tts", voicesH.GenerateTTS)
	mux.HandleFunc("POST /api/voices/tts/multi", voicesH.GenerateMultiSpeakerTTS)

	// Custom Presets
	mux.HandleFunc("GET /api/presets", presetsH.ListPresets)
	mux.HandleFunc("GET /api/presets/{id}", presetsH.GetPreset)
	mux.HandleFunc("POST /api/presets", presetsH.CreatePreset)
	mux.HandleFunc("PUT /api/presets/{id}", presetsH.UpdatePreset)
	mux.HandleFunc("DELETE /api/presets/{id}", presetsH.DeletePreset)
	mux.HandleFunc("GET /api/presets/{id}/audio", presetsH.GetPresetAudio)
}
