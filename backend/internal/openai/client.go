// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package openai implements a TTS client for the OpenAI TTS API.
package openai

import (
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const baseURL = "https://api.openai.com/v1"

// AllowedVoices is the set of valid OpenAI TTS voices.
var AllowedVoices = map[string]bool{
	"alloy": true, "echo": true, "fable": true,
	"onyx": true, "nova": true, "shimmer": true,
}

// Client interacts with the OpenAI TTS API.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new OpenAI client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// GenerateTTS generates speech using OpenAI's TTS API.
// Returns base64-encoded PCM audio (24kHz, 16-bit, mono) to match Gemini format.
func (c *Client) GenerateTTS(text, voice, model string) (string, error) {
	if voice == "" {
		voice = "alloy"
	}
	if model == "" {
		model = "tts-1"
	}

	// Request PCM format at 24000 Hz to match Gemini's output format
	body := fmt.Sprintf(`{"model":%q,"input":%q,"voice":%q,"response_format":"pcm"}`,
		model, text, voice)

	req, err := http.NewRequest("POST", baseURL+"/audio/speech", strings.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("openai request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("openai TTS error (%d): %s", resp.StatusCode, string(errBody))
	}

	audioBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read audio response: %w", err)
	}

	return base64.StdEncoding.EncodeToString(audioBytes), nil
}

// TestKey validates the API key by making a lightweight models list call.
func (c *Client) TestKey() error {
	req, err := http.NewRequest("GET", baseURL+"/models", nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("invalid API key (status %d)", resp.StatusCode)
	}
	return nil
}
