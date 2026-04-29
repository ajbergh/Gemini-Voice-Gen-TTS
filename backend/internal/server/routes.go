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
func RegisterRoutes(mux *http.ServeMux, configH *handler.ConfigHandler, keysH *handler.KeysHandler, historyH *handler.HistoryHandler, voicesH *handler.VoicesHandler, presetsH *handler.PresetsHandler, favoritesH *handler.FavoritesHandler, cacheH *handler.CacheHandler, backupH *handler.BackupHandler, jobsH *handler.JobsHandler, projectsH *handler.ProjectsHandler, takesH *handler.TakesHandler, batchH *handler.BatchHandler, pronunciationH *handler.PronunciationHandler, exportProfilesH *handler.ExportProfilesHandler, stitchH *handler.StitchHandler, castH *handler.CastHandler, stylesH *handler.StylesHandler, qcH *handler.QcHandler, clientH *handler.ClientHandler, providersH *handler.ProvidersHandler, progressH *handler.ProgressHub, exportsH *handler.ExportsHandler, scriptPrepH *handler.ScriptPrepHandler) {
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

	// Jobs
	mux.HandleFunc("GET /api/jobs", jobsH.ListJobs)
	mux.HandleFunc("GET /api/jobs/{id}", jobsH.GetJob)
	mux.HandleFunc("PATCH /api/jobs/{id}/cancel", batchH.CancelJob)

	// Script projects
	mux.HandleFunc("GET /api/projects/summary", projectsH.ListProjectSummaries)
	mux.HandleFunc("GET /api/projects", projectsH.ListProjects)
	mux.HandleFunc("POST /api/projects", projectsH.CreateProject)
	mux.HandleFunc("GET /api/projects/{id}", projectsH.GetProject)
	mux.HandleFunc("PUT /api/projects/{id}", projectsH.UpdateProject)
	mux.HandleFunc("DELETE /api/projects/{id}", projectsH.ArchiveProject)
	mux.HandleFunc("GET /api/projects/{id}/sections", projectsH.ListSections)
	mux.HandleFunc("POST /api/projects/{id}/sections", projectsH.CreateSection)
	mux.HandleFunc("PUT /api/projects/{id}/sections/{sectionId}", projectsH.UpdateSection)
	mux.HandleFunc("DELETE /api/projects/{id}/sections/{sectionId}", projectsH.DeleteSection)
	mux.HandleFunc("GET /api/projects/{id}/segments", projectsH.ListSegments)
	mux.HandleFunc("POST /api/projects/{id}/segments", projectsH.CreateSegment)
	mux.HandleFunc("PUT /api/projects/{id}/segments/{segmentId}", projectsH.UpdateSegment)
	mux.HandleFunc("DELETE /api/projects/{id}/segments/{segmentId}", projectsH.DeleteSegment)
	mux.HandleFunc("POST /api/projects/{id}/import/preview", projectsH.PreviewProjectImport)
	mux.HandleFunc("POST /api/projects/{id}/import", projectsH.ImportProject)
	mux.HandleFunc("POST /api/projects/{id}/batch-render", batchH.BatchRenderProject)
	mux.HandleFunc("POST /api/projects/{id}/segments/{segmentId}/render", batchH.RenderSegment)
	mux.HandleFunc("POST /api/projects/{id}/stitch", stitchH.StitchProject)

	// Cast bible
	mux.HandleFunc("GET /api/projects/{id}/cast", castH.ListProjectCast)
	mux.HandleFunc("POST /api/projects/{id}/cast", castH.CreateProjectCast)
	mux.HandleFunc("GET /api/cast/{profileId}", castH.GetCastProfile)
	mux.HandleFunc("PUT /api/cast/{profileId}", castH.UpdateCastProfile)
	mux.HandleFunc("DELETE /api/cast/{profileId}", castH.DeleteCastProfile)
	mux.HandleFunc("GET /api/cast/{profileId}/versions", castH.ListCastProfileVersions)
	mux.HandleFunc("POST /api/cast/{profileId}/versions/{versionId}/revert", castH.RevertCastProfileVersion)
	mux.HandleFunc("POST /api/cast/{profileId}/audition", castH.AuditionCastProfile)

	// Performance styles
	mux.HandleFunc("GET /api/styles", stylesH.ListStyles)
	mux.HandleFunc("POST /api/styles", stylesH.CreateStyle)
	mux.HandleFunc("GET /api/styles/{id}", stylesH.GetStyle)
	mux.HandleFunc("PUT /api/styles/{id}", stylesH.UpdateStyle)
	mux.HandleFunc("DELETE /api/styles/{id}", stylesH.DeleteStyle)
	mux.HandleFunc("GET /api/styles/{id}/versions", stylesH.ListStyleVersions)
	mux.HandleFunc("POST /api/styles/{id}/versions/{versionId}/revert", stylesH.RevertStyleVersion)

	// Segment takes
	mux.HandleFunc("GET /api/projects/{id}/segments/{segmentId}/takes", takesH.ListTakes)
	mux.HandleFunc("POST /api/projects/{id}/segments/{segmentId}/takes", takesH.CreateTake)
	mux.HandleFunc("GET /api/projects/{id}/segments/{segmentId}/takes/{takeId}", takesH.GetTake)
	mux.HandleFunc("DELETE /api/projects/{id}/segments/{segmentId}/takes/{takeId}", takesH.DeleteTake)
	mux.HandleFunc("GET /api/projects/{id}/segments/{segmentId}/takes/{takeId}/audio", takesH.GetTakeAudio)
	mux.HandleFunc("GET /api/projects/{id}/segments/{segmentId}/takes/{takeId}/notes", takesH.ListTakeNotes)
	mux.HandleFunc("POST /api/projects/{id}/segments/{segmentId}/takes/{takeId}/notes", takesH.CreateTakeNote)
	mux.HandleFunc("DELETE /api/projects/{id}/segments/{segmentId}/takes/{takeId}/notes/{noteId}", takesH.DeleteTakeNote)

	// Pronunciation dictionaries
	mux.HandleFunc("GET /api/projects/{id}/dictionaries", pronunciationH.ListDictionaries)
	mux.HandleFunc("POST /api/projects/{id}/dictionaries", pronunciationH.CreateDictionary)
	mux.HandleFunc("GET /api/projects/{id}/dictionaries/{dictId}", pronunciationH.GetDictionary)
	mux.HandleFunc("PUT /api/projects/{id}/dictionaries/{dictId}", pronunciationH.UpdateDictionary)
	mux.HandleFunc("DELETE /api/projects/{id}/dictionaries/{dictId}", pronunciationH.DeleteDictionary)
	mux.HandleFunc("GET /api/projects/{id}/dictionaries/{dictId}/entries", pronunciationH.ListEntries)
	mux.HandleFunc("POST /api/projects/{id}/dictionaries/{dictId}/entries", pronunciationH.CreateEntry)
	mux.HandleFunc("PUT /api/projects/{id}/dictionaries/{dictId}/entries/{entryId}", pronunciationH.UpdateEntry)
	mux.HandleFunc("DELETE /api/projects/{id}/dictionaries/{dictId}/entries/{entryId}", pronunciationH.DeleteEntry)
	mux.HandleFunc("POST /api/projects/{id}/dictionaries/{dictId}/preview", pronunciationH.PreviewDictionary)
	mux.HandleFunc("GET /api/pronunciation/dictionaries", pronunciationH.ListGlobalDictionaries)
	mux.HandleFunc("POST /api/pronunciation/dictionaries", pronunciationH.CreateGlobalDictionary)
	mux.HandleFunc("GET /api/pronunciation/dictionaries/{dictId}", pronunciationH.GetGlobalDictionary)
	mux.HandleFunc("PUT /api/pronunciation/dictionaries/{dictId}", pronunciationH.UpdateGlobalDictionary)
	mux.HandleFunc("DELETE /api/pronunciation/dictionaries/{dictId}", pronunciationH.DeleteGlobalDictionary)
	mux.HandleFunc("GET /api/pronunciation/dictionaries/{dictId}/entries", pronunciationH.ListGlobalEntries)
	mux.HandleFunc("POST /api/pronunciation/dictionaries/{dictId}/entries", pronunciationH.CreateGlobalEntry)
	mux.HandleFunc("PUT /api/pronunciation/dictionaries/{dictId}/entries/{entryId}", pronunciationH.UpdateGlobalEntry)
	mux.HandleFunc("DELETE /api/pronunciation/dictionaries/{dictId}/entries/{entryId}", pronunciationH.DeleteGlobalEntry)
	mux.HandleFunc("POST /api/pronunciation/dictionaries/{dictId}/preview", pronunciationH.PreviewGlobalDictionary)

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

	// Export profiles
	mux.HandleFunc("GET /api/export-profiles", exportProfilesH.ListExportProfiles)
	mux.HandleFunc("POST /api/export-profiles", exportProfilesH.CreateExportProfile)
	mux.HandleFunc("GET /api/export-profiles/{id}", exportProfilesH.GetExportProfile)
	mux.HandleFunc("PUT /api/export-profiles/{id}", exportProfilesH.UpdateExportProfile)
	mux.HandleFunc("DELETE /api/export-profiles/{id}", exportProfilesH.DeleteExportProfile)

	// QC / Review workflow
	mux.HandleFunc("GET /api/projects/{id}/qc", qcH.ListProjectQcIssues)
	mux.HandleFunc("POST /api/projects/{id}/qc", qcH.CreateQcIssue)
	mux.HandleFunc("GET /api/projects/{id}/qc/rollup", qcH.GetProjectQcRollup)
	mux.HandleFunc("GET /api/projects/{id}/qc/export", qcH.ExportQcIssues)
	mux.HandleFunc("GET /api/qc/{issueId}", qcH.GetQcIssue)
	mux.HandleFunc("PUT /api/qc/{issueId}", qcH.UpdateQcIssue)
	mux.HandleFunc("DELETE /api/qc/{issueId}", qcH.DeleteQcIssue)
	mux.HandleFunc("POST /api/qc/{issueId}/resolve", qcH.ResolveQcIssue)
	mux.HandleFunc("POST /api/projects/{id}/takes/{takeId}/approve", qcH.ApproveTake)
	mux.HandleFunc("POST /api/projects/{id}/takes/{takeId}/flag", qcH.FlagTake)

	// Provider registry
	mux.HandleFunc("GET /api/providers", providersH.ListProviders)

	// Clients / brand workspaces
	mux.HandleFunc("GET /api/clients", clientH.ListClients)
	mux.HandleFunc("POST /api/clients", clientH.CreateClient)
	mux.HandleFunc("GET /api/clients/{id}", clientH.GetClient)
	mux.HandleFunc("PUT /api/clients/{id}", clientH.UpdateClient)
	mux.HandleFunc("DELETE /api/clients/{id}", clientH.DeleteClient)
	mux.HandleFunc("GET /api/clients/{id}/assets", clientH.ListClientAssets)
	mux.HandleFunc("POST /api/clients/{id}/assets", clientH.AddClientAsset)
	mux.HandleFunc("DELETE /api/clients/{id}/assets/{assetId}", clientH.RemoveClientAsset)

	// Export jobs (Plan 11 — deliverable packaging)
	mux.HandleFunc("POST /api/projects/{id}/exports", exportsH.StartExport)
	mux.HandleFunc("GET /api/projects/{id}/exports", exportsH.ListExports)
	mux.HandleFunc("GET /api/exports/{exportId}", exportsH.GetExport)
	mux.HandleFunc("GET /api/exports/{exportId}/download", exportsH.DownloadExport)

	// AI Script Prep (Plan 12)
	mux.HandleFunc("POST /api/projects/{id}/prepare-script", scriptPrepH.PrepareScript)
	mux.HandleFunc("GET /api/projects/{id}/prepare-script", scriptPrepH.GetLatestPrepResult)
	mux.HandleFunc("POST /api/projects/{id}/script-prep/apply", scriptPrepH.ApplyScriptPrep)

	// WebSocket Progress
	mux.HandleFunc("/api/ws/progress", progressH.HandleWS)
}
