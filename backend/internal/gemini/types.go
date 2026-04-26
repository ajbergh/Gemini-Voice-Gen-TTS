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
	PersonDescription string   `json:"personDescription"`
}

// TTSRequest is the payload from the frontend for TTS generation.
type TTSRequest struct {
	Text              string `json:"text"`
	VoiceName         string `json:"voiceName"`
	SystemInstruction string `json:"systemInstruction,omitempty"`
	LanguageCode      string `json:"languageCode,omitempty"`
	Model             string `json:"model,omitempty"`
	Provider          string `json:"provider,omitempty"` // reserved; this application is Gemini-only
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
	Model        string          `json:"model,omitempty"`
}

// SpeakerConfig maps a speaker label to a voice name.
type SpeakerConfig struct {
	Speaker   string `json:"speaker"`
	VoiceName string `json:"voiceName"`
}

// ScriptPrepOptions controls which analysis passes are enabled.
type ScriptPrepOptions struct {
	ProjectKind           string `json:"project_kind"`
	DetectSpeakers        bool   `json:"detect_speakers"`
	SuggestPronunciations bool   `json:"suggest_pronunciations"`
	SuggestStyles         bool   `json:"suggest_styles"`
	MaxSegmentLength      int    `json:"max_segment_length"`
}

// ScriptPrepSegment is a single proposed segment from AI script prep.
type ScriptPrepSegment struct {
	ScriptText   string  `json:"script_text"`
	SpeakerLabel string  `json:"speaker_label,omitempty"`
	Confidence   float64 `json:"confidence,omitempty"`
}

// ScriptPrepSection is a proposed chapter/scene section.
type ScriptPrepSection struct {
	Title    string              `json:"title"`
	Kind     string              `json:"kind"`
	Segments []ScriptPrepSegment `json:"segments"`
}

// ScriptPrepSpeakerCandidate is an inferred speaker identity.
type ScriptPrepSpeakerCandidate struct {
	Label       string   `json:"label"`
	Occurrences int      `json:"occurrences"`
	SampleLines []string `json:"sample_lines"`
}

// ScriptPrepPronunciationCandidate is a word that may need a pronunciation rule.
type ScriptPrepPronunciationCandidate struct {
	Word     string `json:"word"`
	Phonetic string `json:"phonetic,omitempty"`
	Notes    string `json:"notes,omitempty"`
}

// ScriptPrepResult is the structured response from PrepareScriptForNarration.
type ScriptPrepResult struct {
	Sections               []ScriptPrepSection              `json:"sections"`
	SpeakerCandidates      []ScriptPrepSpeakerCandidate     `json:"speaker_candidates"`
	PronunciationCandidates []ScriptPrepPronunciationCandidate `json:"pronunciation_candidates"`
	StyleSuggestions       []string                         `json:"style_suggestions"`
	Warnings               []string                         `json:"warnings"`
}

