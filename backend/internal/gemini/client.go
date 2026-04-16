// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package gemini implements a raw HTTP client for the Google Gemini API.
//
// It supports two operations: voice recommendation (using gemini-3-flash-preview
// with structured JSON output) and text-to-speech generation (using
// gemini-3.1-flash-tts-preview with AUDIO response modality). API key
// validation is provided via a lightweight models.list call.
package gemini

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"
)

// maxTTSRetries is the number of attempts for TTS generation. The Gemini docs
// note the model occasionally returns text tokens instead of audio, causing a
// 500 error in a small percentage of requests.
const maxTTSRetries = 3

const baseURL = "https://generativelanguage.googleapis.com/v1beta"

// Client interacts with the Gemini API.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a Gemini API client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey:     apiKey,
		httpClient: &http.Client{Timeout: 120 * time.Second},
	}
}

// Recommend calls Gemini to get voice recommendations based on a query.
func (c *Client) Recommend(query string, voices []VoiceData) (*RecommendResponse, error) {
	voicesJSON, err := json.Marshal(voices)
	if err != nil {
		return nil, fmt.Errorf("marshal voices: %w", err)
	}

	prompt := fmt.Sprintf(`You are an expert voice casting director.

Available Voices Data:
%s

User Request: "%s"

IMPORTANT: any voice can do any accent by simply prompting for it in the director's note.

Task:
1. Select the top 3 voices from the available list that best match the user's request.
2. Create a detailed System Instruction that defines the persona/character.
3. Write a brief sample text paragraph (2-3 sentences).

PROMPT STRUCTURE (Markdown):
Ensure you use double newlines between sections so it renders correctly as markdown headers.

## Audio Profile
Establishes a persona for the voice, defining a character identity, archetype and any other characteristics like age, background etc.

## Scene
Sets the stage. Describes both the physical environment and the "vibe".

## Director's Notes
Performance guidance where you can break down which instructions are important for your virtual talent to take note of. Examples are style, breathing, pacing, articulation and accent.

## Sample context
Gives the model a contextual starting point, so your virtual actor enters the scene you set up naturally.

## Transcript
The text that the model will speak out.`, string(voicesJSON), query)

	reqBody := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]any{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]any{
			"responseMimeType": "application/json",
			"responseSchema": map[string]any{
				"type": "OBJECT",
				"properties": map[string]any{
					"recommendedVoices": map[string]any{
						"type":        "ARRAY",
						"items":       map[string]any{"type": "STRING"},
						"description": "Array of exactly 3 voice names",
					},
					"systemInstruction": map[string]any{
						"type":        "STRING",
						"description": "System prompt. Formatted as Markdown with newlines.",
					},
					"sampleText": map[string]any{
						"type":        "STRING",
						"description": "Sample text",
					},
				},
			},
		},
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/gemini-3-flash-preview:generateContent?key=%s", baseURL, c.apiKey)
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return nil, fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("gemini API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Parse the Gemini response envelope
	var envelope struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, fmt.Errorf("parse response envelope: %w", err)
	}

	if len(envelope.Candidates) == 0 || len(envelope.Candidates[0].Content.Parts) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	var result RecommendResponse
	if err := json.Unmarshal([]byte(envelope.Candidates[0].Content.Parts[0].Text), &result); err != nil {
		return nil, fmt.Errorf("parse recommendation result: %w", err)
	}

	return &result, nil
}

// GenerateTTS calls Gemini TTS to generate speech audio.
// An optional systemInstruction shapes the voice's delivery style by prepending
// it to the spoken text (TTS models only accept text content, not a separate
// systemInstruction field). Any existing Transcript section in the system
// instruction is stripped and replaced with the user's text.
// An optional languageCode (e.g. "en", "es") overrides automatic language detection.
func (c *Client) GenerateTTS(text, voiceName, systemInstruction, languageCode string) (string, error) {
	spokenText := text
	if systemInstruction != "" {
		// Strip existing Transcript section from the system instruction
		// so the model reads the user's text, not the sample text.
		directions := systemInstruction
		for _, marker := range []string{"## Transcript", "## TRANSCRIPT", "##Transcript"} {
			if idx := strings.Index(strings.ToLower(directions), strings.ToLower(marker)); idx >= 0 {
				directions = strings.TrimRight(directions[:idx], "\n\r ")
				break
			}
		}
		spokenText = directions + "\n\n## Transcript\n" + text
	}

	speechConfig := map[string]any{
		"voiceConfig": map[string]any{
			"prebuiltVoiceConfig": map[string]any{
				"voiceName": voiceName,
			},
		},
	}
	if languageCode != "" {
		speechConfig["languageCode"] = languageCode
	}

	reqBody := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]any{
					{"text": spokenText},
				},
			},
		},
		"generationConfig": map[string]any{
			"responseModalities": []string{"AUDIO"},
			"speechConfig":       speechConfig,
		},
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/gemini-3.1-flash-tts-preview:generateContent?key=%s", baseURL, c.apiKey)

	var lastErr error
	for attempt := range maxTTSRetries {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
			slog.Warn("retrying TTS request", "attempt", attempt+1, "lastError", lastErr)
		}

		resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(data))
		if err != nil {
			lastErr = fmt.Errorf("http request: %w", err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("read response: %w", err)
			continue
		}

		// Retry on 500 — the model occasionally returns text tokens instead of audio.
		if resp.StatusCode == http.StatusInternalServerError && attempt < maxTTSRetries-1 {
			lastErr = fmt.Errorf("gemini TTS API error (status 500): %s", string(body))
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("gemini TTS API error (status %d): %s", resp.StatusCode, string(body))
		}

		var envelope struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						InlineData *struct {
							Data     string `json:"data"`
							MimeType string `json:"mimeType"`
						} `json:"inlineData"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if err := json.Unmarshal(body, &envelope); err != nil {
			return "", fmt.Errorf("parse response: %w", err)
		}

		if len(envelope.Candidates) == 0 || len(envelope.Candidates[0].Content.Parts) == 0 {
			return "", fmt.Errorf("empty TTS response from Gemini")
		}

		inlineData := envelope.Candidates[0].Content.Parts[0].InlineData
		if inlineData == nil || inlineData.Data == "" {
			return "", fmt.Errorf("no audio data in TTS response")
		}

		return inlineData.Data, nil
	}
	return "", fmt.Errorf("TTS failed after %d retries: %w", maxTTSRetries, lastErr)
}

// GenerateMultiSpeakerTTS calls Gemini TTS to generate multi-speaker dialogue audio.
// Each SpeakerConfig maps a speaker label (e.g. "Speaker1") to a Gemini voice name.
// The text should contain speaker labels like "Speaker1: Hello\nSpeaker2: Hi there".
func (c *Client) GenerateMultiSpeakerTTS(text string, speakers []SpeakerConfig, languageCode string) (string, error) {
	speakerVoiceConfigs := make([]map[string]any, len(speakers))
	for i, s := range speakers {
		speakerVoiceConfigs[i] = map[string]any{
			"speaker": s.Speaker,
			"voiceConfig": map[string]any{
				"prebuiltVoiceConfig": map[string]any{
					"voiceName": s.VoiceName,
				},
			},
		}
	}

	speechConfig := map[string]any{
		"multiSpeakerVoiceConfig": map[string]any{
			"speakerVoiceConfigs": speakerVoiceConfigs,
		},
	}
	if languageCode != "" {
		speechConfig["languageCode"] = languageCode
	}

	reqBody := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]any{
					{"text": text},
				},
			},
		},
		"generationConfig": map[string]any{
			"responseModalities": []string{"AUDIO"},
			"speechConfig":       speechConfig,
		},
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/gemini-3.1-flash-tts-preview:generateContent?key=%s", baseURL, c.apiKey)

	var lastErr error
	for attempt := range maxTTSRetries {
		if attempt > 0 {
			slog.Warn("retrying multi-speaker TTS request", "attempt", attempt+1, "maxRetries", maxTTSRetries)
			time.Sleep(time.Duration(attempt) * 500 * time.Millisecond)
		}

		resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(data))
		if err != nil {
			lastErr = fmt.Errorf("http request: %w", err)
			continue
		}

		body, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			lastErr = fmt.Errorf("read response: %w", err)
			continue
		}

		if resp.StatusCode == http.StatusInternalServerError {
			lastErr = fmt.Errorf("gemini TTS API error (status 500): %s", string(body))
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("gemini TTS API error (status %d): %s", resp.StatusCode, string(body))
		}

		var envelope struct {
			Candidates []struct {
				Content struct {
					Parts []struct {
						InlineData *struct {
							Data     string `json:"data"`
							MimeType string `json:"mimeType"`
						} `json:"inlineData"`
					} `json:"parts"`
				} `json:"content"`
			} `json:"candidates"`
		}
		if err := json.Unmarshal(body, &envelope); err != nil {
			return "", fmt.Errorf("parse response: %w", err)
		}

		if len(envelope.Candidates) == 0 || len(envelope.Candidates[0].Content.Parts) == 0 {
			return "", fmt.Errorf("empty TTS response from Gemini")
		}

		inlineData := envelope.Candidates[0].Content.Parts[0].InlineData
		if inlineData == nil || inlineData.Data == "" {
			return "", fmt.Errorf("no audio data in TTS response")
		}

		return inlineData.Data, nil
	}
	return "", fmt.Errorf("multi-speaker TTS failed after %d retries: %w", maxTTSRetries, lastErr)
}

// TestKey makes a lightweight API call to validate the key.
func (c *Client) TestKey() error {
	reqBody := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]any{
					{"text": "Say hello."},
				},
			},
		},
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/gemini-3-flash-preview:generateContent?key=%s", baseURL, c.apiKey)
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API key validation failed (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}
