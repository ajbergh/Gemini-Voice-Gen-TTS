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

	// Use voices from the request if provided, otherwise load from DB
	voices := req.Voices
	if len(voices) == 0 {
		var err error
		voices, err = h.getVoiceData()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to load voice data")
			return
		}
	}

	client := gemini.NewClient(apiKey)
	result, err := client.Recommend(req.Query, voices)
	if err != nil {
		slog.Error("gemini recommend failed", "error", err)
		writeError(w, http.StatusBadGateway, "AI recommendation failed")
		return
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
	})
}

// GenerateTTS proxies TTS requests to Gemini.
func (h *VoicesHandler) GenerateTTS(w http.ResponseWriter, r *http.Request) {
	apiKey, err := h.KeysHandler.GetDecryptedKey("gemini")
	if err != nil {
		writeError(w, http.StatusPreconditionFailed, "no Gemini API key configured — add one via Settings")
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

	client := gemini.NewClient(apiKey)
	audioBase64, err := client.GenerateTTS(req.Text, req.VoiceName, req.SystemInstruction)
	if err != nil {
		slog.Error("gemini TTS failed", "error", err, "voice", req.VoiceName, "hasSystemInstruction", req.SystemInstruction != "")
		writeError(w, http.StatusBadGateway, "TTS generation failed: "+err.Error())
		return
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
