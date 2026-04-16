// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package gemini defines the request/response types for the Gemini API client.
package gemini

// RecommendRequest is the payload from the frontend for voice recommendations.
type RecommendRequest struct {
	Query  string      `json:"query"`
	Voices []VoiceData `json:"voices,omitempty"` // optional: frontend can send simplified voice data
}

// RecommendResponse is the structured response from Gemini for voice recommendations.
type RecommendResponse struct {
	RecommendedVoices []string `json:"recommendedVoices"`
	SystemInstruction string   `json:"systemInstruction"`
	SampleText        string   `json:"sampleText"`
}

// TTSRequest is the payload from the frontend for TTS generation.
type TTSRequest struct {
	Text              string `json:"text"`
	VoiceName         string `json:"voiceName"`
	SystemInstruction string `json:"systemInstruction,omitempty"`
	LanguageCode      string `json:"languageCode,omitempty"`
}

// TTSResponse is the response back to the frontend.
type TTSResponse struct {
	AudioBase64 string `json:"audioBase64"`
}

// VoiceData is the simplified voice info sent to Gemini for recommendation prompts.
type VoiceData struct {
	Name            string   `json:"name"`
	Gender          string   `json:"gender"`
	Pitch           string   `json:"pitch"`
	Characteristics []string `json:"characteristics"`
}

// MultiSpeakerTTSRequest is the payload for multi-speaker dialogue.
type MultiSpeakerTTSRequest struct {
	Text         string          `json:"text"`
	Speakers     []SpeakerConfig `json:"speakers"`
	LanguageCode string          `json:"languageCode,omitempty"`
}

// SpeakerConfig maps a speaker label to a voice name.
type SpeakerConfig struct {
	Speaker   string `json:"speaker"`
	VoiceName string `json:"voiceName"`
}
