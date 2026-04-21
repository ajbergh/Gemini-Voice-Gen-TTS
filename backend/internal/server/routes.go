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
func RegisterRoutes(mux *http.ServeMux, configH *handler.ConfigHandler, keysH *handler.KeysHandler, historyH *handler.HistoryHandler, voicesH *handler.VoicesHandler, presetsH *handler.PresetsHandler, favoritesH *handler.FavoritesHandler, cacheH *handler.CacheHandler, backupH *handler.BackupHandler, progressH *handler.ProgressHub) {
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
	mux.HandleFunc("GET /api/keys/{provider}/pool", keysH.ListKeyPool)
	mux.HandleFunc("POST /api/keys/{provider}/pool", keysH.AddKeyToPool)
	mux.HandleFunc("DELETE /api/keys/{provider}/pool", keysH.DeleteKeyFromPool)
	mux.HandleFunc("POST /api/keys/{provider}/pool/reset", keysH.ResetPoolKey)

	// History
	mux.HandleFunc("GET /api/history/export", historyH.ExportHistory)
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
	mux.HandleFunc("POST /api/voices/tts/stream", voicesH.GenerateTTSStream)
	mux.HandleFunc("POST /api/voices/format-script", voicesH.FormatScript)

	// Custom Presets
	mux.HandleFunc("GET /api/presets", presetsH.ListPresets)
	mux.HandleFunc("GET /api/presets/tags", presetsH.ListAllTags)
	mux.HandleFunc("GET /api/presets/export", presetsH.ExportPresets)
	mux.HandleFunc("POST /api/presets/import", presetsH.ImportPresets)
	mux.HandleFunc("PATCH /api/presets/reorder", presetsH.ReorderPresets)
	mux.HandleFunc("GET /api/presets/{id}", presetsH.GetPreset)
	mux.HandleFunc("POST /api/presets", presetsH.CreatePreset)
	mux.HandleFunc("PUT /api/presets/{id}", presetsH.UpdatePreset)
	mux.HandleFunc("DELETE /api/presets/{id}", presetsH.DeletePreset)
	mux.HandleFunc("GET /api/presets/{id}/audio", presetsH.GetPresetAudio)
	mux.HandleFunc("GET /api/presets/{id}/image", presetsH.GetPresetImage)
	mux.HandleFunc("POST /api/presets/{id}/image/regenerate", presetsH.RegeneratePresetImage)
	mux.HandleFunc("PUT /api/presets/{id}/tags", presetsH.SetPresetTags)
	mux.HandleFunc("GET /api/presets/{id}/versions", presetsH.ListPresetVersions)
	mux.HandleFunc("POST /api/presets/{id}/versions/{versionId}/revert", presetsH.RevertPresetVersion)

	// Favorites
	mux.HandleFunc("GET /api/favorites", favoritesH.ListFavorites)
	mux.HandleFunc("POST /api/favorites", favoritesH.ToggleFavorite)

	// Cache management
	mux.HandleFunc("GET /api/cache/stats", cacheH.GetCacheStats)
	mux.HandleFunc("DELETE /api/cache", cacheH.ClearCache)

	// Backup & Restore
	mux.HandleFunc("POST /api/backup", backupH.CreateBackup)
	mux.HandleFunc("POST /api/restore", backupH.RestoreBackup)

	// WebSocket Progress
	mux.HandleFunc("/api/ws/progress", progressH.HandleWS)
}
