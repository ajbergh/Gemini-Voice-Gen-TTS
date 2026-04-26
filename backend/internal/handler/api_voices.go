// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_voices.go implements HTTP handlers for voice listing,
// AI voice recommendations, and TTS generation at /api/voices.
package handler

import (
	"encoding/base64"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/gemini"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// VoicesHandler handles /api/voices endpoints.
type VoicesHandler struct {
	Store         *store.Store
	KeysHandler   *KeysHandler
	AudioCacheDir string // directory for cached TTS audio files
	ProgressHub   *ProgressHub
}

// Recommend proxies AI casting requests to Gemini.
func (h *VoicesHandler) Recommend(w http.ResponseWriter, r *http.Request) {
	apiKey, err := h.KeysHandler.GetDecryptedKey("gemini")
	if err != nil {
		writeError(w, http.StatusPreconditionFailed, "no Gemini API key configured — add one via Settings")
		return
	}

	var req gemini.RecommendRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.Query == "" {
		writeError(w, http.StatusBadRequest, "query is required")
		return
	}

	jobID := fmt.Sprintf("recommend_%d", time.Now().UnixMilli())
	if h.ProgressHub != nil {
		h.ProgressHub.EmitProgress(jobID, "recommend", "processing", "Finding matching voices...", 10)
	}

	// Use voices from the request if provided, otherwise load from DB
	voices := req.Voices
	if len(voices) == 0 {
		var err error
		voices, err = h.getVoiceData()
		if err != nil {
			if h.ProgressHub != nil {
				h.ProgressHub.EmitProgress(jobID, "recommend", "error", "Failed to load voice data", 0)
			}
			writeError(w, http.StatusInternalServerError, "failed to load voice data")
			return
		}
	}

	client := gemini.NewClient(apiKey)
	result, err := client.Recommend(req.Query, voices)
	if err != nil {
		if h.ProgressHub != nil {
			h.ProgressHub.EmitProgress(jobID, "recommend", "error", "AI casting failed", 0)
		}
		slog.Error("gemini recommend failed", "error", err)
		writeError(w, http.StatusBadGateway, "AI recommendation failed")
		return
	}

	if h.ProgressHub != nil {
		h.ProgressHub.EmitProgress(jobID, "recommend", "complete", "Voice matches ready", 100)
	}

	// Save to history
	resultJSON, _ := json.Marshal(result)
	h.Store.InsertHistory(store.HistoryEntry{
		Type:       "recommendation",
		InputText:  req.Query,
		ResultJSON: strPtr(string(resultJSON)),
	})

	writeJSON(w, http.StatusOK, map[string]any{
		"voiceNames":        result.RecommendedVoices,
		"systemInstruction": result.SystemInstruction,
		"sampleText":        result.SampleText,
		"personDescription": result.PersonDescription,
	})
}

// GenerateTTS proxies TTS requests to Gemini.
func (h *VoicesHandler) GenerateTTS(w http.ResponseWriter, r *http.Request) {
	var req gemini.TTSRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.Text == "" || req.VoiceName == "" {
		writeError(w, http.StatusBadRequest, "text and voiceName are required")
		return
	}

	jobID := fmt.Sprintf("tts_%d", time.Now().UnixMilli())

	apiKey, err := h.KeysHandler.GetDecryptedKey("gemini")
	if err != nil {
		writeError(w, http.StatusPreconditionFailed, "no Gemini API key configured — add one via Settings")
		return
	}
	if h.ProgressHub != nil {
		h.ProgressHub.EmitProgress(jobID, "tts", "processing", "Generating speech for "+req.VoiceName+"...", 10)
	}
	client := gemini.NewClient(apiKey)
	audioBase64, genErr := client.GenerateTTS(req.Text, req.VoiceName, req.SystemInstruction, req.LanguageCode, req.Model)

	if genErr != nil {
		if h.ProgressHub != nil {
			h.ProgressHub.EmitProgress(jobID, "tts", "error", "TTS generation failed", 0)
		}
		slog.Error("TTS failed", "error", genErr, "provider", req.Provider, "voice", req.VoiceName)
		writeError(w, http.StatusBadGateway, "TTS generation failed: "+genErr.Error())
		return
	}

	if h.ProgressHub != nil {
		h.ProgressHub.EmitProgress(jobID, "tts", "complete", "Audio ready", 100)
	}

	// Save audio to cache and history
	var audioPath *string
	if h.AudioCacheDir != "" {
		safeName := sanitizeForFilename(req.VoiceName)
		filename := fmt.Sprintf("tts_%d_%s.raw", time.Now().UnixMilli(), safeName)
		cachePath, ok := safeCachePath(h.AudioCacheDir, filename)
		if !ok {
			slog.Warn("invalid cache path computed", "voice", req.VoiceName)
		} else {
			audioBytes, decErr := base64.StdEncoding.DecodeString(audioBase64)
			if decErr == nil {
				if writeErr := os.WriteFile(cachePath, audioBytes, 0o600); writeErr == nil {
					audioPath = &cachePath
				} else {
					slog.Warn("failed to cache audio", "error", writeErr)
				}
			}
		}
	}

	voiceName := req.VoiceName
	h.Store.InsertHistory(store.HistoryEntry{
		Type:      "tts",
		VoiceName: &voiceName,
		InputText: req.Text,
		AudioPath: audioPath,
	})

	writeJSON(w, http.StatusOK, gemini.TTSResponse{AudioBase64: audioBase64})
}

// GenerateMultiSpeakerTTS proxies multi-speaker dialogue TTS requests to Gemini.
func (h *VoicesHandler) GenerateMultiSpeakerTTS(w http.ResponseWriter, r *http.Request) {
	apiKey, err := h.KeysHandler.GetDecryptedKey("gemini")
	if err != nil {
		writeError(w, http.StatusPreconditionFailed, "no Gemini API key configured — add one via Settings")
		return
	}

	var req gemini.MultiSpeakerTTSRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	if req.Text == "" {
		writeError(w, http.StatusBadRequest, "text is required")
		return
	}
	if len(req.Speakers) < 1 || len(req.Speakers) > 2 {
		writeError(w, http.StatusBadRequest, "1 or 2 speakers are required")
		return
	}
	for _, s := range req.Speakers {
		if s.Speaker == "" || s.VoiceName == "" {
			writeError(w, http.StatusBadRequest, "each speaker must have a speaker name and voiceName")
			return
		}
	}

	jobID := fmt.Sprintf("multi_tts_%d", time.Now().UnixMilli())
	if h.ProgressHub != nil {
		h.ProgressHub.EmitProgress(jobID, "multi_tts", "processing", "Generating dialogue audio...", 10)
	}

	client := gemini.NewClient(apiKey)
	audioBase64, err := client.GenerateMultiSpeakerTTS(req.Text, req.Speakers, req.LanguageCode, req.Model)
	if err != nil {
		if h.ProgressHub != nil {
			h.ProgressHub.EmitProgress(jobID, "multi_tts", "error", "Dialogue generation failed", 0)
		}
		slog.Error("gemini multi-speaker TTS failed", "error", err, "speakerCount", len(req.Speakers))
		writeError(w, http.StatusBadGateway, "Multi-speaker TTS generation failed: "+err.Error())
		return
	}

	if h.ProgressHub != nil {
		h.ProgressHub.EmitProgress(jobID, "multi_tts", "complete", "Dialogue audio ready", 100)
	}

	// Save audio to cache and history
	var audioPath *string
	if h.AudioCacheDir != "" {
		filename := fmt.Sprintf("tts_multi_%d.raw", time.Now().UnixMilli())
		cachePath, ok := safeCachePath(h.AudioCacheDir, filename)
		if !ok {
			slog.Warn("invalid cache path computed for multi-speaker")
		} else {
			audioBytes, decErr := base64.StdEncoding.DecodeString(audioBase64)
			if decErr == nil {
				if writeErr := os.WriteFile(cachePath, audioBytes, 0o600); writeErr == nil {
					audioPath = &cachePath
				} else {
					slog.Warn("failed to cache multi-speaker audio", "error", writeErr)
				}
			}
		}
	}

	h.Store.InsertHistory(store.HistoryEntry{
		Type:      "tts_multi",
		InputText: req.Text,
		AudioPath: audioPath,
	})

	writeJSON(w, http.StatusOK, gemini.TTSResponse{AudioBase64: audioBase64})
}

// ListVoices returns the voice library data.
func (h *VoicesHandler) ListVoices(w http.ResponseWriter, r *http.Request) {
	rows, err := h.Store.DB().Query(
		"SELECT name, pitch, gender, characteristics, audio_sample_url, file_uri, analysis_json, image_url FROM voices ORDER BY name",
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to query voices")
		return
	}
	defer rows.Close()

	var voices []map[string]any
	for rows.Next() {
		var name, pitch, gender, chars, audioURL, fileURI, analysisJSON, imageURL string
		if err := rows.Scan(&name, &pitch, &gender, &chars, &audioURL, &fileURI, &analysisJSON, &imageURL); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to scan voice")
			return
		}

		var characteristics []string
		json.Unmarshal([]byte(chars), &characteristics)

		var analysis map[string]any
		json.Unmarshal([]byte(analysisJSON), &analysis)

		voices = append(voices, map[string]any{
			"name":            name,
			"pitch":           pitch,
			"characteristics": characteristics,
			"audioSampleUrl":  audioURL,
			"fileUri":         fileURI,
			"analysis":        analysis,
			"imageUrl":        imageURL,
		})
	}

	if voices == nil {
		voices = []map[string]any{}
	}
	writeJSON(w, http.StatusOK, voices)
}

// getVoiceData retrieves simplified voice data for Gemini prompts.
func (h *VoicesHandler) getVoiceData() ([]gemini.VoiceData, error) {
	rows, err := h.Store.DB().Query("SELECT name, gender, pitch, characteristics FROM voices ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var voices []gemini.VoiceData
	for rows.Next() {
		var v gemini.VoiceData
		var chars string
		if err := rows.Scan(&v.Name, &v.Gender, &v.Pitch, &chars); err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(chars), &v.Characteristics)
		voices = append(voices, v)
	}
	return voices, rows.Err()
}

func strPtr(s string) *string {
	return &s
}

// FormatScript sends script text to Gemini for TTS-optimised reformatting.
func (h *VoicesHandler) FormatScript(w http.ResponseWriter, r *http.Request) {
	apiKey, err := h.KeysHandler.GetDecryptedKey("gemini")
	if err != nil {
		writeError(w, http.StatusPreconditionFailed, "no Gemini API key configured — add one via Settings")
		return
	}

	var req struct {
		Script string `json:"script"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Script == "" {
		writeError(w, http.StatusBadRequest, "script is required")
		return
	}

	jobID := fmt.Sprintf("script_prep_%d", time.Now().UnixMilli())
	if h.ProgressHub != nil {
		h.ProgressHub.EmitProgress(jobID, "script_prep", "processing", "Formatting script...", 10)
	}

	client := gemini.NewClient(apiKey)
	formatted, err := client.FormatScript(req.Script)
	if err != nil {
		if h.ProgressHub != nil {
			h.ProgressHub.EmitProgress(jobID, "script_prep", "error", "Script formatting failed", 0)
		}
		slog.Error("FormatScript failed", "error", err)
		writeError(w, http.StatusInternalServerError, "failed to format script")
		return
	}

	if h.ProgressHub != nil {
		h.ProgressHub.EmitProgress(jobID, "script_prep", "complete", "Script formatted", 100)
	}

	writeJSON(w, http.StatusOK, map[string]string{"formatted": formatted})
}

// GenerateTTSStream uses Server-Sent Events to stream TTS audio chunks.
func (h *VoicesHandler) GenerateTTSStream(w http.ResponseWriter, r *http.Request) {
	apiKey, err := h.KeysHandler.GetDecryptedKey("gemini")
	if err != nil {
		writeError(w, http.StatusPreconditionFailed, "no Gemini API key configured")
		return
	}

	var req gemini.TTSRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if req.Text == "" || req.VoiceName == "" {
		writeError(w, http.StatusBadRequest, "text and voiceName are required")
		return
	}

	jobID := fmt.Sprintf("tts_stream_%d", time.Now().UnixMilli())
	if h.ProgressHub != nil {
		h.ProgressHub.EmitProgress(jobID, "tts_stream", "processing", "Streaming speech for "+req.VoiceName+"...", 10)
	}

	// Set SSE headers
	flusher, ok := w.(http.Flusher)
	if !ok {
		if h.ProgressHub != nil {
			h.ProgressHub.EmitProgress(jobID, "tts_stream", "error", "Streaming is not supported by this response", 0)
		}
		writeError(w, http.StatusInternalServerError, "streaming not supported")
		return
	}

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	client := gemini.NewClient(apiKey)
	chunks := make(chan gemini.StreamTTSChunk, 16)

	errCh := make(chan error, 1)
	go func() {
		errCh <- client.GenerateTTSStream(req.Text, req.VoiceName, req.SystemInstruction, req.LanguageCode, req.Model, chunks)
	}()

	for chunk := range chunks {
		data, _ := json.Marshal(chunk)
		fmt.Fprintf(w, "data: %s\n\n", data)
		flusher.Flush()
	}

	if err := <-errCh; err != nil {
		if h.ProgressHub != nil {
			h.ProgressHub.EmitProgress(jobID, "tts_stream", "error", "Streaming speech failed", 0)
		}
		slog.Error("streaming TTS failed", "error", err)
		errData, _ := json.Marshal(map[string]string{"error": err.Error()})
		fmt.Fprintf(w, "data: %s\n\n", errData)
		flusher.Flush()
		return
	}

	if h.ProgressHub != nil {
		h.ProgressHub.EmitProgress(jobID, "tts_stream", "complete", "Streaming speech complete", 100)
	}
}
