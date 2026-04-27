// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_batch.go implements HTTP handlers for batch segment
// rendering under /api/projects/{id}/batch-render and job cancellation at
// PATCH /api/jobs/{id}/cancel.
package handler

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	audioanalysis "github.com/ajbergh/gemini-voice-gen-tts/backend/internal/audio"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/gemini"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/promptbuilder"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/pronunciation"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// BatchHandler handles batch render and job cancellation endpoints.
type BatchHandler struct {
	Store         *store.Store
	KeysHandler   *KeysHandler
	AudioCacheDir string
	ProgressHub   *ProgressHub

	mu      sync.Mutex
	cancels map[string]context.CancelFunc
}

// batchRenderBody is the optional request body for POST /api/projects/{id}/batch-render.
type batchRenderBody struct {
	// SegmentIDs limits the render to specific segments; empty renders all draft/changed.
	SegmentIDs []int64 `json:"segment_ids,omitempty"`
	// SegmentIDsLegacy accepts the old frontend camelCase payload for compatibility.
	SegmentIDsLegacy []int64 `json:"segmentIds,omitempty"`
	// Force renders segments regardless of current status (bypasses draft/changed filter).
	Force bool `json:"force,omitempty"`
}

// batchRenderResponse is the immediate response returned to the caller before
// the background render completes.
type batchRenderResponse struct {
	JobID        string `json:"job_id"`
	SegmentCount int    `json:"segment_count"`
}

// BatchRenderProject enqueues all eligible segments of a project for batch TTS
// rendering.  It responds immediately with a job_id and launches a background
// goroutine that emits progress events over WebSocket.
//
// POST /api/projects/{id}/batch-render
func (h *BatchHandler) BatchRenderProject(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}

	var body batchRenderBody
	// Body is optional — ignore decode errors
	_ = decodeJSON(r, &body)

	// Load project for default voice/model resolution.
	project, err := h.Store.GetProject(projectID)
	if err != nil {
		writeStoreError(w, err, "project not found", "failed to get project")
		return
	}

	// Load all segments.
	allSegments, err := h.Store.ListProjectSegments(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list segments")
		return
	}

	// Filter to renderable segments.
	segmentIDs := body.SegmentIDs
	if len(segmentIDs) == 0 {
		segmentIDs = body.SegmentIDsLegacy
	}
	segments := filterRenderableSegments(allSegments, segmentIDs, body.Force)
	if len(segments) == 0 {
		writeError(w, http.StatusUnprocessableEntity, "no renderable segments found (all segments are up-to-date or project is empty)")
		return
	}

	jobID := fmt.Sprintf("batch_%d_%d", projectID, time.Now().UnixMilli())

	// Register cancellation context.
	ctx, cancel := context.WithCancel(context.Background())
	h.mu.Lock()
	if h.cancels == nil {
		h.cancels = make(map[string]context.CancelFunc)
	}
	h.cancels[jobID] = cancel
	h.mu.Unlock()

	// Emit queued event before launching goroutine so the job appears in the
	// frontend before the first WebSocket frame arrives.
	if h.ProgressHub != nil {
		h.ProgressHub.Broadcast(ProgressEvent{
			JobID:      jobID,
			Type:       "batch_render",
			Status:     "queued",
			Message:    fmt.Sprintf("Queued %d segments for rendering", len(segments)),
			TotalItems: len(segments),
			ProjectID:  fmt.Sprintf("%d", projectID),
		})
	}

	go h.runBatchRender(ctx, jobID, projectID, project, segments)

	writeJSON(w, http.StatusAccepted, batchRenderResponse{
		JobID:        jobID,
		SegmentCount: len(segments),
	})
}

// RenderSegment renders a single segment on demand, creating a new SegmentTake
// and updating the segment status.  This is the per-segment counterpart of
// BatchRenderProject and reuses the same renderOneSegment logic.
//
// POST /api/projects/{id}/segments/{segmentId}/render
func (h *BatchHandler) RenderSegment(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}
	segmentID, ok := parsePathInt64(w, r, "segmentId", "invalid segment ID")
	if !ok {
		return
	}

	project, err := h.Store.GetProject(projectID)
	if err != nil {
		writeStoreError(w, err, "project not found", "failed to get project")
		return
	}

	segments, err := h.Store.ListProjectSegments(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list segments")
		return
	}
	var seg *store.ScriptSegment
	for i := range segments {
		if segments[i].ID == segmentID {
			seg = &segments[i]
			break
		}
	}
	if seg == nil {
		writeError(w, http.StatusNotFound, "segment not found")
		return
	}
	if seg.ScriptText == "" {
		writeError(w, http.StatusUnprocessableEntity, "segment has no script text")
		return
	}

	ctx := r.Context()
	_ = h.Store.UpdateSegmentStatus(projectID, segmentID, "rendering")

	if err := h.renderOneSegment(ctx, projectID, project, *seg); err != nil {
		_ = h.Store.UpdateSegmentStatus(projectID, segmentID, "failed")
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Return the newest take for this segment so the frontend can update its list.
	takes, err := h.Store.ListSegmentTakes(projectID, segmentID)
	if err != nil || len(takes) == 0 {
		writeJSON(w, http.StatusOK, map[string]string{"status": "rendered"})
		return
	}
	writeJSON(w, http.StatusOK, takes[0])
}

// CancelJob cancels a running batch render job.
//
// PATCH /api/jobs/{id}/cancel
func (h *BatchHandler) CancelJob(w http.ResponseWriter, r *http.Request) {
	jobID := r.PathValue("id")
	if jobID == "" {
		writeError(w, http.StatusBadRequest, "job ID is required")
		return
	}

	h.mu.Lock()
	cancel, found := h.cancels[jobID]
	if found {
		delete(h.cancels, jobID)
	}
	h.mu.Unlock()

	if !found {
		// Job may have already completed — return 200 (idempotent).
		writeJSON(w, http.StatusOK, map[string]string{"status": "not_found"})
		return
	}

	cancel()
	writeJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}

// ---------------------------------------------------------------------------
// Background render goroutine
// ---------------------------------------------------------------------------

func (h *BatchHandler) runBatchRender(
	ctx context.Context,
	jobID string,
	projectID int64,
	project *store.ScriptProject,
	segments []store.ScriptSegment,
) {
	defer func() {
		h.mu.Lock()
		delete(h.cancels, jobID)
		h.mu.Unlock()
	}()

	total := len(segments)
	completed := 0
	failed := 0
	pidStr := fmt.Sprintf("%d", projectID)

	emit := func(status, message string, percent, comp, fail int, segID int64) {
		if h.ProgressHub == nil {
			return
		}
		ev := ProgressEvent{
			JobID:          jobID,
			Type:           "batch_render",
			Status:         status,
			Message:        message,
			Percent:        percent,
			TotalItems:     total,
			CompletedItems: comp,
			FailedItems:    fail,
			ProjectID:      pidStr,
		}
		if segID > 0 {
			ev.SegmentID = fmt.Sprintf("%d", segID)
		}
		h.ProgressHub.Broadcast(ev)
	}

	emit("running", fmt.Sprintf("Rendering %d segments…", total), 0, 0, 0, 0)

	for i, seg := range segments {
		select {
		case <-ctx.Done():
			emit("cancelled", fmt.Sprintf("Cancelled after %d/%d segments", completed, total),
				completedPercent(completed, total), completed, failed, seg.ID)
			return
		default:
		}

		_ = h.Store.UpdateSegmentStatus(projectID, seg.ID, "rendering")
		emit("running",
			fmt.Sprintf("Rendering segment %d of %d…", i+1, total),
			completedPercent(i, total), completed, failed, seg.ID)

		if err := h.renderOneSegment(ctx, projectID, project, seg); err != nil {
			failed++
			slog.Error("batch render: segment failed", "segment_id", seg.ID, "error", err)
			_ = h.Store.UpdateSegmentStatus(projectID, seg.ID, "failed")
		} else {
			completed++
		}
	}

	finalStatus := "complete"
	if failed == total {
		finalStatus = "failed"
	}
	emit(finalStatus,
		fmt.Sprintf("Rendered %d/%d segments (%d failed)", completed, total, failed),
		100, completed, failed, 0)
}

// renderOneSegment calls Gemini TTS for a single segment, persists the audio,
// creates a SegmentTake, and updates the segment status to "rendered".
func (h *BatchHandler) renderOneSegment(
	ctx context.Context,
	projectID int64,
	project *store.ScriptProject,
	seg store.ScriptSegment,
) error {
	// Resolve voice/persona: cast profile → segment override → project/preset default.
	voiceName := derefStr(seg.VoiceName)
	castLangCode := ""
	var pbIn promptbuilder.Input
	var castProfileID *int64
	var presetID *int64

	// Resolve cast profile: voice, language, persona.
	if seg.CastProfileID != nil {
		if profile, perr := h.Store.GetCastProfile(*seg.CastProfileID); perr == nil {
			castProfileID = seg.CastProfileID
			if profile.VoiceName != nil && *profile.VoiceName != "" {
				voiceName = *profile.VoiceName
			}
			if profile.LanguageCode != nil {
				castLangCode = *profile.LanguageCode
			}
			pbIn.CastRole = profile.Role
			pbIn.CastDescription = profile.Description
			pbIn.CastPronunciationNotes = derefStr(profile.PronunciationNotes)

			// Resolve style from cast profile if segment has no override.
			if seg.StyleID == nil && profile.StyleID != nil {
				seg.StyleID = profile.StyleID
			}
			if seg.PresetID == nil && profile.PresetID != nil {
				seg.PresetID = profile.PresetID
			}
		}
	}
	presetID = seg.PresetID
	if presetID == nil {
		presetID = project.DefaultPresetID
	}
	if presetID != nil {
		if preset, perr := h.Store.GetCustomPreset(*presetID); perr == nil {
			if voiceName == "" {
				voiceName = preset.VoiceName
			}
			pbIn.PresetInstruction = derefStr(preset.SystemInstruction)
		}
	}
	if voiceName == "" {
		voiceName = derefStr(project.DefaultVoiceName)
	}
	if voiceName == "" {
		return fmt.Errorf("segment %d: no voice configured", seg.ID)
	}

	provider := h.resolveProvider(project, seg)
	model := h.resolveModel(provider, project, seg)
	langCode := derefStr(seg.LanguageCode)
	if langCode == "" {
		langCode = castLangCode
	}
	if langCode == "" {
		langCode = derefStr(project.DefaultLanguageCode)
	}
	if langCode == "" {
		langCode, _ = h.Store.GetConfig(store.ConfigKeyDefaultLanguageCode)
	}

	appVoiceName := voiceName
	providerVoice, err := h.resolveProviderVoice(projectID, "gemini", appVoiceName, provider)
	if err != nil {
		return fmt.Errorf("segment %d: %w", seg.ID, err)
	}

	fallbackProvider := h.resolveFallbackProvider(project, seg)
	fallbackModel := h.resolveFallbackModel(fallbackProvider, project, seg)
	fallbackVoice := ""
	if fallbackProvider != "" && fallbackProvider != provider {
		fallbackVoice, err = h.resolveProviderVoice(projectID, "gemini", appVoiceName, fallbackProvider)
		if err != nil {
			return fmt.Errorf("segment %d fallback: %w", seg.ID, err)
		}
	}

	// Resolve style: segment → cast profile → project default.
	styleID := seg.StyleID
	if styleID == nil {
		styleID = project.DefaultStyleID
	}
	if styleID != nil {
		if style, serr := h.Store.GetStyle(*styleID); serr == nil {
			pbIn.StyleName = style.Name
			pbIn.StyleDirectorNotes = style.DirectorNotes
			pbIn.StylePacing = derefStr(style.Pacing)
			pbIn.StyleEnergy = derefStr(style.Energy)
			pbIn.StyleEmotion = derefStr(style.Emotion)
			pbIn.StyleArticulation = derefStr(style.Articulation)
			pbIn.StylePauseDensity = derefStr(style.PauseDensity)
		}
	}

	// Check for cancellation before making the network call.
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// Apply pronunciation dictionary if the project has any enabled entries.
	renderText := seg.ScriptText
	var dictionaryHash string
	if entries, err := h.Store.ListEnabledEntriesForProject(projectID); err == nil && len(entries) > 0 {
		dictionaryHash = hashPronunciationEntries(entries)
		renderText = pronunciation.ApplyDictionary(renderText, entries)
	}

	// Compose system instruction via promptbuilder.
	systemInstruction, promptHash := promptbuilder.Compose(pbIn)

	audioBase64, usedProvider, usedModel, usedProviderVoice, usedFallback, err := h.generateWithFallback(
		ctx,
		seg,
		renderText,
		systemInstruction,
		langCode,
		provider,
		model,
		providerVoice,
		fallbackProvider,
		fallbackModel,
		fallbackVoice,
	)
	if err != nil {
		return fmt.Errorf("segment %d: TTS: %w", seg.ID, err)
	}

	// Decode PCM audio.
	audioBytes, err := base64.StdEncoding.DecodeString(audioBase64)
	if err != nil {
		return fmt.Errorf("segment %d: decode audio: %w", seg.ID, err)
	}

	// Persist audio to cache directory.
	var audioPath *string
	if h.AudioCacheDir != "" {
		safeName := sanitizeForFilename(usedProviderVoice)
		filename := fmt.Sprintf("batch_%d_%d_%d_%s.raw", projectID, seg.ID, time.Now().UnixMilli(), safeName)
		if cachePath, ok := safeCachePath(h.AudioCacheDir, filename); ok {
			if writeErr := os.WriteFile(cachePath, audioBytes, 0o600); writeErr == nil {
				audioPath = &cachePath
			} else {
				slog.Warn("batch render: failed to cache audio", "segment_id", seg.ID, "error", writeErr)
			}
		}
	}

	metrics := audioanalysis.AnalyzePCM16LE(audioBytes, audioanalysis.DefaultSampleRate, audioanalysis.DefaultChannels)
	sampleRate := metrics.SampleRate
	channels := metrics.Channels
	format := metrics.Format
	voiceNameForTake := appVoiceName
	providerVoiceForTake := usedProviderVoice
	providerForTake := usedProvider
	modelForTakeValue := usedModel

	var langCodeForTake *string
	if langCode != "" {
		langCodeForTake = &langCode
	}
	var modelForTake *string
	if modelForTakeValue != "" {
		modelForTake = &modelForTakeValue
	}
	var sysInstrForTake *string
	if systemInstruction != "" {
		sysInstrForTake = &systemInstruction
	}
	settingsJSON := marshalRenderSettings(map[string]any{
		"provider":          usedProvider,
		"model":             usedModel,
		"provider_voice":    usedProviderVoice,
		"app_voice_name":    appVoiceName,
		"fallback_provider": fallbackProvider,
		"fallback_model":    fallbackModel,
		"used_fallback":     usedFallback,
		"dictionary_hash":   dictionaryHash,
		"prompt_hash":       promptHash,
	})

	// Create a SegmentTake record.
	take := store.SegmentTake{
		ProjectID:         projectID,
		SegmentID:         seg.ID,
		VoiceName:         &voiceNameForTake,
		SpeakerLabel:      seg.SpeakerLabel,
		LanguageCode:      langCodeForTake,
		Provider:          &providerForTake,
		Model:             modelForTake,
		ProviderVoice:     &providerVoiceForTake,
		AppVoiceName:      &voiceNameForTake,
		PresetID:          presetID,
		StyleID:           styleID,
		AccentID:          seg.AccentID,
		CastProfileID:     castProfileID,
		DictionaryHash:    optionalStringPtr(dictionaryHash),
		PromptHash:        optionalStringPtr(promptHash),
		SettingsJSON:      settingsJSON,
		SystemInstruction: sysInstrForTake,
		ScriptText:        seg.ScriptText,
		AudioPath:         audioPath,
		DurationSeconds:   &metrics.DurationSeconds,
		PeakDbfs:          finiteFloatPtr(metrics.PeakDbfs),
		RmsDbfs:           finiteFloatPtr(metrics.RmsDbfs),
		ClippingDetected:  metrics.ClippingDetected,
		SampleRate:        &sampleRate,
		Channels:          &channels,
		Format:            &format,
		Status:            "rendered",
	}
	takeID, err := h.Store.CreateTake(take)
	if err != nil {
		slog.Warn("batch render: failed to create take", "segment_id", seg.ID, "error", err)
		// Non-fatal: still mark the segment rendered.
	} else if h.shouldCreateClippingIssue(metrics) {
		note := fmt.Sprintf("Rendered audio peaks at %.2f dBFS and should be reviewed for clipping or limiter artifacts.", metrics.PeakDbfs)
		if metrics.ClippingDetected {
			note = "Rendered audio contains clipped PCM samples and should be reviewed for distortion."
		}
		if _, err := h.Store.CreateQcIssue(store.QcIssue{
			ProjectID: projectID,
			SegmentID: seg.ID,
			TakeID:    &takeID,
			IssueType: "volume",
			Severity:  "high",
			Note:      note,
			Status:    "open",
		}); err != nil {
			slog.Warn("batch render: failed to create clipping qc issue", "segment_id", seg.ID, "take_id", takeID, "error", err)
		}
	}

	return h.Store.UpdateSegmentStatus(projectID, seg.ID, "rendered")
}

// shouldCreateClippingIssue applies QC config to rendered audio metrics.
func (h *BatchHandler) shouldCreateClippingIssue(metrics audioanalysis.Analysis) bool {
	if !strings.EqualFold(h.Store.GetConfigValue(store.ConfigKeyQcAutoFlagClipping, "true"), "true") {
		return false
	}
	if metrics.ClippingDetected {
		return true
	}
	if math.IsInf(metrics.PeakDbfs, 0) || math.IsNaN(metrics.PeakDbfs) {
		return false
	}
	threshold := -0.1
	if raw := strings.TrimSpace(h.Store.GetConfigValue(store.ConfigKeyQcClippingThresholdDb, "-0.1")); raw != "" {
		if parsed, err := strconv.ParseFloat(raw, 64); err == nil {
			threshold = parsed
		}
	}
	return metrics.PeakDbfs >= threshold
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// filterRenderableSegments returns segments eligible for rendering.
// If segmentIDs is non-empty, only those IDs are considered.
// Unless force is true, only "draft" and "changed" status segments are included.
func filterRenderableSegments(segments []store.ScriptSegment, ids []int64, force bool) []store.ScriptSegment {
	idSet := make(map[int64]bool, len(ids))
	for _, id := range ids {
		idSet[id] = true
	}

	var out []store.ScriptSegment
	for _, seg := range segments {
		if len(idSet) > 0 && !idSet[seg.ID] {
			continue
		}
		if !force && seg.Status != "draft" && seg.Status != "changed" {
			continue
		}
		if seg.ScriptText == "" {
			continue
		}
		out = append(out, seg)
	}
	return out
}

// derefStr dereferences a *string safely, returning "" for nil.
func derefStr(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// finiteFloatPtr converts invalid floating-point metrics to nil for JSON/database use.
func finiteFloatPtr(value float64) *float64 {
	if math.IsNaN(value) || math.IsInf(value, 0) {
		return nil
	}
	return &value
}

// optionalStringPtr trims empty strings to nil for nullable render metadata.
func optionalStringPtr(value string) *string {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	return &value
}

// marshalRenderSettings stores reproducible render settings as JSON.
func marshalRenderSettings(value map[string]any) *string {
	data, err := json.Marshal(value)
	if err != nil {
		return nil
	}
	out := string(data)
	return &out
}

// hashPronunciationEntries fingerprints enabled pronunciation rules used for a render.
func hashPronunciationEntries(entries []store.PronunciationEntry) string {
	if len(entries) == 0 {
		return ""
	}
	h := sha256.New()
	for _, e := range entries {
		fmt.Fprintf(h, "%d|%d|%s|%s|%t|%t|%d\n",
			e.ID, e.DictionaryID, e.RawWord, e.Replacement, e.IsRegex, e.Enabled, e.SortOrder)
	}
	return fmt.Sprintf("%x", h.Sum(nil))
}

// resolveProvider selects the effective TTS provider from segment, project, client, or global defaults.
func (h *BatchHandler) resolveProvider(project *store.ScriptProject, seg store.ScriptSegment) string {
	if value := derefStr(seg.Provider); value != "" {
		return normalizeProvider(value)
	}
	if value := derefStr(project.DefaultProvider); value != "" {
		return normalizeProvider(value)
	}
	if project.ClientID != nil {
		if client, err := h.Store.GetClient(*project.ClientID); err == nil {
			if value := derefStr(client.DefaultProvider); value != "" {
				return normalizeProvider(value)
			}
		}
	}
	if value, _ := h.Store.GetConfig(store.ConfigKeyDefaultProvider); strings.TrimSpace(value) != "" {
		return normalizeProvider(value)
	}
	return "gemini"
}

// resolveModel selects a provider-compatible model from segment, project, client, or global defaults.
func (h *BatchHandler) resolveModel(provider string, project *store.ScriptProject, seg store.ScriptSegment) string {
	if value := derefStr(seg.Model); value != "" {
		return value
	}
	if normalizeProviderIfSet(derefStr(seg.Provider)) != "" {
		return defaultModelForProvider(provider)
	}
	if value := derefStr(project.DefaultModel); value != "" {
		if defaultModelUsableForProvider(provider, derefStr(project.DefaultProvider), value) {
			return value
		}
	}
	if project.ClientID != nil {
		if client, err := h.Store.GetClient(*project.ClientID); err == nil {
			if value := derefStr(client.DefaultModel); value != "" {
				if defaultModelUsableForProvider(provider, derefStr(client.DefaultProvider), value) {
					return value
				}
			}
		}
	}
	if value, _ := h.Store.GetConfig(store.ConfigKeyDefaultModel); strings.TrimSpace(value) != "" {
		globalProvider, _ := h.Store.GetConfig(store.ConfigKeyDefaultProvider)
		if defaultModelUsableForProvider(provider, globalProvider, value) {
			return strings.TrimSpace(value)
		}
	}
	return defaultModelForProvider(provider)
}

// resolveFallbackProvider selects the optional fallback provider for failed renders.
func (h *BatchHandler) resolveFallbackProvider(project *store.ScriptProject, seg store.ScriptSegment) string {
	if value := derefStr(seg.FallbackProvider); value != "" {
		return normalizeProvider(value)
	}
	if value := derefStr(project.FallbackProvider); value != "" {
		return normalizeProvider(value)
	}
	if project.ClientID != nil {
		if client, err := h.Store.GetClient(*project.ClientID); err == nil {
			if value := derefStr(client.FallbackProvider); value != "" {
				return normalizeProvider(value)
			}
		}
	}
	if value, _ := h.Store.GetConfig(store.ConfigKeyFallbackProvider); strings.TrimSpace(value) != "" {
		return normalizeProvider(value)
	}
	return ""
}

// resolveFallbackModel selects a provider-compatible fallback model.
func (h *BatchHandler) resolveFallbackModel(provider string, project *store.ScriptProject, seg store.ScriptSegment) string {
	if provider == "" {
		return ""
	}
	if value := derefStr(seg.FallbackModel); value != "" {
		return value
	}
	if normalizeProviderIfSet(derefStr(seg.FallbackProvider)) != "" {
		return defaultModelForProvider(provider)
	}
	if value := derefStr(project.FallbackModel); value != "" {
		if defaultModelUsableForProvider(provider, derefStr(project.FallbackProvider), value) {
			return value
		}
	}
	if project.ClientID != nil {
		if client, err := h.Store.GetClient(*project.ClientID); err == nil {
			if value := derefStr(client.FallbackModel); value != "" {
				if defaultModelUsableForProvider(provider, derefStr(client.FallbackProvider), value) {
					return value
				}
			}
		}
	}
	if value, _ := h.Store.GetConfig(store.ConfigKeyFallbackModel); strings.TrimSpace(value) != "" {
		globalProvider, _ := h.Store.GetConfig(store.ConfigKeyFallbackProvider)
		if defaultModelUsableForProvider(provider, globalProvider, value) {
			return strings.TrimSpace(value)
		}
	}
	return defaultModelForProvider(provider)
}

// resolveProviderVoice maps the app voice to the selected provider voice.
func (h *BatchHandler) resolveProviderVoice(projectID int64, sourceProvider, sourceVoice, targetProvider string) (string, error) {
	// This application is Gemini-only. The source voice is always a Gemini voice
	// and is passed through unchanged — no cross-provider mapping is needed.
	_ = projectID
	_ = sourceProvider
	_ = targetProvider
	return sourceVoice, nil
}

// generateWithFallback attempts primary TTS first, then the configured fallback when allowed.
func (h *BatchHandler) generateWithFallback(
	ctx context.Context,
	seg store.ScriptSegment,
	text string,
	systemInstruction string,
	languageCode string,
	provider string,
	model string,
	providerVoice string,
	fallbackProvider string,
	fallbackModel string,
	fallbackVoice string,
) (audioBase64, usedProvider, usedModel, usedProviderVoice string, usedFallback bool, err error) {
	audioBase64, err = h.generateProviderTTS(ctx, provider, model, providerVoice, text, systemInstruction, languageCode)
	if err == nil {
		return audioBase64, provider, model, providerVoice, false, nil
	}
	if fallbackProvider == "" || fallbackProvider == provider || !fallbackAllowedForSegment(seg) {
		return "", provider, model, providerVoice, false, err
	}
	if fallbackModel == "" {
		fallbackModel = defaultModelForProvider(fallbackProvider)
	}
	audioBase64, fallbackErr := h.generateProviderTTS(ctx, fallbackProvider, fallbackModel, fallbackVoice, text, systemInstruction, languageCode)
	if fallbackErr != nil {
		return "", provider, model, providerVoice, false, fmt.Errorf("%w; fallback %s also failed: %v", err, fallbackProvider, fallbackErr)
	}
	return audioBase64, fallbackProvider, fallbackModel, fallbackVoice, true, nil
}

// generateProviderTTS performs the provider-specific TTS call for one segment.
func (h *BatchHandler) generateProviderTTS(
	ctx context.Context,
	provider string,
	model string,
	voice string,
	text string,
	systemInstruction string,
	languageCode string,
) (string, error) {
	select {
	case <-ctx.Done():
		return "", ctx.Err()
	default:
	}
	// This application is Gemini-only. All provider values are normalised to "gemini".
	apiKey, err := h.KeysHandler.GetDecryptedKey("gemini")
	if err != nil {
		return "", fmt.Errorf("no Gemini API key: %w", err)
	}
	return gemini.NewClient(apiKey).GenerateTTS(text, voice, systemInstruction, languageCode, model)
}

// fallbackAllowedForSegment prevents fallback replacement for approved or locked work.
func fallbackAllowedForSegment(seg store.ScriptSegment) bool {
	switch strings.ToLower(seg.Status) {
	case "approved", "locked":
		return false
	default:
		return true
	}
}

// defaultModelForProvider returns the registry default for a normalized provider ID.
func defaultModelForProvider(provider string) string {
	provider = normalizeProvider(provider)
	for _, p := range registry {
		if strings.EqualFold(p.ID, provider) {
			return p.DefaultModel
		}
	}
	return "gemini-2.5-flash-preview-tts"
}

// defaultModelUsableForProvider checks whether an inherited model matches the selected provider.
func defaultModelUsableForProvider(provider, configuredProvider, model string) bool {
	if configuredProvider = normalizeProviderIfSet(configuredProvider); configuredProvider != "" && configuredProvider != provider {
		return false
	}
	return modelCompatibleWithProvider(provider, model)
}

// modelCompatibleWithProvider rejects known models that belong to a different provider.
func modelCompatibleWithProvider(provider, model string) bool {
	model = strings.TrimSpace(model)
	if model == "" {
		return true
	}
	provider = normalizeProvider(provider)
	foundProvider := false
	modelBelongsToOtherProvider := false
	for _, p := range registry {
		matchesProvider := strings.EqualFold(p.ID, provider)
		if matchesProvider {
			foundProvider = true
		}
		for _, candidate := range p.Models {
			if !strings.EqualFold(candidate.ID, model) {
				continue
			}
			if matchesProvider {
				return true
			}
			modelBelongsToOtherProvider = true
		}
	}
	if !foundProvider {
		return true
	}
	return !modelBelongsToOtherProvider
}

// normalizeProvider canonicalizes provider IDs and migrates legacy values to Gemini.
func normalizeProvider(provider string) string {
	switch strings.ToLower(strings.TrimSpace(provider)) {
	case "", "google", "google-gemini", "openai":
		// All non-Gemini provider values are coerced to "gemini".
		// This handles legacy DB rows that may still carry provider = "openai".
		return "gemini"
	default:
		return strings.ToLower(strings.TrimSpace(provider))
	}
}

// normalizeProviderIfSet preserves an unset provider while normalizing non-empty values.
func normalizeProviderIfSet(provider string) string {
	if strings.TrimSpace(provider) == "" {
		return ""
	}
	return normalizeProvider(provider)
}

// completedPercent returns an integer 0-99 progress percentage.
func completedPercent(done, total int) int {
	if total == 0 {
		return 0
	}
	p := (done * 100) / total
	if p > 99 {
		p = 99
	}
	return p
}
