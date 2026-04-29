// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_providers.go implements the provider registry
// endpoint at GET /api/providers.
package handler

import (
	"net/http"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// ProviderCapabilities describes what a TTS provider supports.
type ProviderCapabilities struct {
	SingleSpeakerTTS  bool `json:"single_speaker_tts"`
	MultiSpeakerTTS   bool `json:"multi_speaker_tts"`
	Streaming         bool `json:"streaming"`
	LanguageSelection bool `json:"language_selection"`
	VoiceList         bool `json:"voice_list"`
	PCMOutput         bool `json:"pcm_output"`
}

// ProviderModel describes a model offered by a provider.
type ProviderModel struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	IsDefault   bool   `json:"is_default,omitempty"`
	Notes       string `json:"notes,omitempty"`
}

// ProviderVoice describes a voice offered by a provider.
type ProviderVoice struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
}

// ProviderInfo describes a TTS provider in the registry.
type ProviderInfo struct {
	ID           string               `json:"id"`
	DisplayName  string               `json:"display_name"`
	Capabilities ProviderCapabilities `json:"capabilities"`
	Models       []ProviderModel      `json:"models"`
	Voices       []ProviderVoice      `json:"voices"`
	DefaultModel string               `json:"default_model"`
	KeyProvider  string               `json:"key_provider"` // key used to fetch from key store
}

// ProvidersHandler handles /api/providers endpoints.
type ProvidersHandler struct {
	Store       *store.Store
	KeysHandler *KeysHandler
}

// registry is the static list of supported providers.
var registry = []ProviderInfo{
	{
		ID:          "gemini",
		DisplayName: "Google Gemini",
		KeyProvider: "gemini",
		Capabilities: ProviderCapabilities{
			SingleSpeakerTTS:  true,
			MultiSpeakerTTS:   true,
			Streaming:         false,
			LanguageSelection: true,
			VoiceList:         true,
			PCMOutput:         true,
		},
		DefaultModel: "gemini-2.5-flash-preview-tts",
		Models: []ProviderModel{
			{ID: "gemini-2.5-flash-preview-tts", DisplayName: "Gemini 2.5 Flash TTS", IsDefault: true},
			{ID: "gemini-2.5-pro-preview-tts", DisplayName: "Gemini 2.5 Pro TTS", Notes: "Higher quality, slower"},
		},
		Voices: []ProviderVoice{
			{ID: "Zephyr", DisplayName: "Zephyr"},
			{ID: "Puck", DisplayName: "Puck"},
			{ID: "Charon", DisplayName: "Charon"},
			{ID: "Kore", DisplayName: "Kore"},
			{ID: "Fenrir", DisplayName: "Fenrir"},
			{ID: "Aoede", DisplayName: "Aoede"},
			{ID: "Leda", DisplayName: "Leda"},
			{ID: "Orus", DisplayName: "Orus"},
			{ID: "Perseus", DisplayName: "Perseus"},
			{ID: "Achernar", DisplayName: "Achernar"},
			{ID: "Alnilam", DisplayName: "Alnilam"},
			{ID: "Schedar", DisplayName: "Schedar"},
			{ID: "Gacrux", DisplayName: "Gacrux"},
			{ID: "Pulcherrima", DisplayName: "Pulcherrima"},
			{ID: "Achird", DisplayName: "Achird"},
			{ID: "Zubenelgenubi", DisplayName: "Zubenelgenubi"},
			{ID: "Vindemiatrix", DisplayName: "Vindemiatrix"},
			{ID: "Sadachbia", DisplayName: "Sadachbia"},
			{ID: "Sadaltager", DisplayName: "Sadaltager"},
			{ID: "Sulafat", DisplayName: "Sulafat"},
			{ID: "Umbriel", DisplayName: "Umbriel"},
			{ID: "Algieba", DisplayName: "Algieba"},
			{ID: "Despina", DisplayName: "Despina"},
			{ID: "Erinome", DisplayName: "Erinome"},
			{ID: "Algenib", DisplayName: "Algenib"},
			{ID: "Rasalgethi", DisplayName: "Rasalgethi"},
			{ID: "Laomedeia", DisplayName: "Laomedeia"},
			{ID: "Acrab", DisplayName: "Acrab"},
			{ID: "Iocaste", DisplayName: "Iocaste"},
			{ID: "Spica", DisplayName: "Spica"},
		},
	},
}

// ListProviders returns the static provider registry with key-configured status.
//
// GET /api/providers
func (h *ProvidersHandler) ListProviders(w http.ResponseWriter, r *http.Request) {
	type providerResponse struct {
		ProviderInfo
		KeyConfigured bool `json:"key_configured"`
	}

	out := make([]providerResponse, len(registry))
	for i, p := range registry {
		_, keyErr := h.KeysHandler.GetDecryptedKey(p.KeyProvider)
		out[i] = providerResponse{
			ProviderInfo:  p,
			KeyConfigured: keyErr == nil,
		}
	}
	writeJSON(w, http.StatusOK, out)
}
