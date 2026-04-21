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
	"bufio"
	"bytes"
	"encoding/base64"
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
// 500 error in a small percentage of requests. The preview TTS model can also
// return 503 (Service Unavailable) under load.
const maxTTSRetries = 4

const baseURL = "https://generativelanguage.googleapis.com/v1beta"

// defaultTTSModel is the default model for TTS generation.
const defaultTTSModel = "gemini-3.1-flash-tts-preview"

// defaultImageModel is the default model for headshot image generation.
const defaultImageModel = "gemini-3.1-flash-image-preview"

// allowedTTSModels is the set of models the frontend is permitted to request.
var allowedTTSModels = map[string]bool{
	"gemini-3.1-flash-tts-preview": true,
	"gemini-2.5-flash-preview-tts": true,
}

// allowedImageModels is the set of image generation models the backend may use.
var allowedImageModels = map[string]bool{
	"gemini-3.1-flash-image-preview": true,
	"gemini-3-pro-image-preview":     true,
	"gemini-2.5-flash-image":         true,
}

type ttsInlineData struct {
	Data     string `json:"data"`
	MimeType string `json:"mimeType"`
}

type ttsResponsePart struct {
	Text       string         `json:"text"`
	InlineData *ttsInlineData `json:"inlineData"`
	Thought    bool           `json:"thought,omitempty"`
}

type ttsResponseEnvelope struct {
	Candidates []struct {
		FinishReason string `json:"finishReason"`
		Content      struct {
			Parts []ttsResponsePart `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
	PromptFeedback struct {
		BlockReason        string `json:"blockReason"`
		BlockReasonMessage string `json:"blockReasonMessage"`
	} `json:"promptFeedback"`
}

func summarizeTTSResponseText(text string) string {
	text = strings.Join(strings.Fields(text), " ")
	if len(text) > 160 {
		return text[:157] + "..."
	}
	return text
}

func parseTTSAudioResponse(body []byte) (string, string, error) {
	var envelope ttsResponseEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return "", "", err
	}

	var textSnippets []string
	var finishReasons []string

	for _, candidate := range envelope.Candidates {
		if candidate.FinishReason != "" {
			finishReasons = append(finishReasons, candidate.FinishReason)
		}
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil && part.InlineData.Data != "" {
				return part.InlineData.Data, "", nil
			}
			if text := strings.TrimSpace(part.Text); text != "" {
				textSnippets = append(textSnippets, summarizeTTSResponseText(text))
			}
		}
	}

	diagnostics := make([]string, 0, 3)
	if envelope.PromptFeedback.BlockReason != "" {
		diagnostic := "prompt blocked: " + envelope.PromptFeedback.BlockReason
		if envelope.PromptFeedback.BlockReasonMessage != "" {
			diagnostic += " (" + envelope.PromptFeedback.BlockReasonMessage + ")"
		}
		diagnostics = append(diagnostics, diagnostic)
	}
	if len(finishReasons) > 0 {
		diagnostics = append(diagnostics, "finish reasons: "+strings.Join(finishReasons, ", "))
	}
	if len(textSnippets) > 0 {
		diagnostics = append(diagnostics, "text parts: "+strings.Join(textSnippets, " | "))
	}
	if len(diagnostics) == 0 {
		diagnostics = append(diagnostics, "response contained no audio parts")
	}

	return "", strings.Join(diagnostics, "; "), nil
}

func parseImageResponse(body []byte) ([]byte, string, string, error) {
	var envelope ttsResponseEnvelope
	if err := json.Unmarshal(body, &envelope); err != nil {
		return nil, "", "", err
	}

	var textSnippets []string
	var finishReasons []string
	var fallbackImageData string
	var fallbackMimeType string

	for _, candidate := range envelope.Candidates {
		if candidate.FinishReason != "" {
			finishReasons = append(finishReasons, candidate.FinishReason)
		}
		for _, part := range candidate.Content.Parts {
			if part.InlineData != nil && part.InlineData.Data != "" && strings.HasPrefix(strings.ToLower(part.InlineData.MimeType), "image/") {
				if !part.Thought {
					imageBytes, err := base64.StdEncoding.DecodeString(part.InlineData.Data)
					if err != nil {
						return nil, "", "", fmt.Errorf("decode image inline data: %w", err)
					}
					return imageBytes, part.InlineData.MimeType, "", nil
				}
				fallbackImageData = part.InlineData.Data
				fallbackMimeType = part.InlineData.MimeType
			}
			if text := strings.TrimSpace(part.Text); text != "" {
				textSnippets = append(textSnippets, summarizeTTSResponseText(text))
			}
		}
	}

	if fallbackImageData != "" {
		imageBytes, err := base64.StdEncoding.DecodeString(fallbackImageData)
		if err != nil {
			return nil, "", "", fmt.Errorf("decode fallback image inline data: %w", err)
		}
		return imageBytes, fallbackMimeType, "", nil
	}

	diagnostics := make([]string, 0, 3)
	if envelope.PromptFeedback.BlockReason != "" {
		diagnostic := "prompt blocked: " + envelope.PromptFeedback.BlockReason
		if envelope.PromptFeedback.BlockReasonMessage != "" {
			diagnostic += " (" + envelope.PromptFeedback.BlockReasonMessage + ")"
		}
		diagnostics = append(diagnostics, diagnostic)
	}
	if len(finishReasons) > 0 {
		diagnostics = append(diagnostics, "finish reasons: "+strings.Join(finishReasons, ", "))
	}
	if len(textSnippets) > 0 {
		diagnostics = append(diagnostics, "text parts: "+strings.Join(textSnippets, " | "))
	}
	if len(diagnostics) == 0 {
		diagnostics = append(diagnostics, "response contained no image parts")
	}

	return nil, "", strings.Join(diagnostics, "; "), nil
}

// resolveTTSModel returns a validated TTS model name or the default.
func resolveTTSModel(model string) string {
	if model != "" && allowedTTSModels[model] {
		return model
	}
	return defaultTTSModel
}

// resolveImageModel returns a validated image model name or the default.
func resolveImageModel(model string) string {
	if model != "" && allowedImageModels[model] {
		return model
	}
	return defaultImageModel
}

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
4. Create a concise visual person description for a professional portrait headshot image prompt. Focus on the person only. Do not include camera, lens, lighting, or background instructions.

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
					"personDescription": map[string]any{
						"type":        "STRING",
						"description": "Concise visual description of the person or character suitable for a professional portrait headshot prompt",
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

// GenerateHeadshot calls Gemini image generation to create a square portrait.
func (c *Client) GenerateHeadshot(prompt, model string) ([]byte, string, error) {
	reqBody := map[string]any{
		"contents": []map[string]any{
			{
				"parts": []map[string]any{
					{"text": prompt},
				},
			},
		},
		"generationConfig": map[string]any{
			"responseModalities": []string{"IMAGE"},
			"imageConfig": map[string]any{
				"aspectRatio": "1:1",
				"imageSize":   "1K",
			},
		},
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return nil, "", fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", baseURL, resolveImageModel(model), c.apiKey)
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return nil, "", fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, "", fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		return nil, "", fmt.Errorf("gemini image API error (status %d): %s", resp.StatusCode, string(body))
	}

	imageBytes, mimeType, diagnostic, err := parseImageResponse(body)
	if err != nil {
		return nil, "", fmt.Errorf("parse response: %w", err)
	}
	if len(imageBytes) == 0 {
		return nil, "", fmt.Errorf("Gemini returned no image data: %s", diagnostic)
	}

	if mimeType == "" {
		mimeType = http.DetectContentType(imageBytes)
	}

	return imageBytes, mimeType, nil
}

// GenerateTTS calls Gemini TTS to generate speech audio.
// An optional systemInstruction shapes the voice's delivery style by prepending
// it to the spoken text (TTS models only accept text content, not a separate
// systemInstruction field). Any existing Transcript section in the system
// instruction is stripped and replaced with the user's text.
// An optional languageCode (e.g. "en", "es") overrides automatic language detection.
func (c *Client) GenerateTTS(text, voiceName, systemInstruction, languageCode, model string) (string, error) {
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

	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", baseURL, resolveTTSModel(model), c.apiKey)

	var lastErr error
	for attempt := range maxTTSRetries {
		if attempt > 0 {
			time.Sleep(time.Duration(attempt) * time.Second)
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

		// Retry on 500/503 — the model occasionally returns text tokens instead of audio
		// or is temporarily overloaded (503 Service Unavailable).
		if (resp.StatusCode == http.StatusInternalServerError || resp.StatusCode == http.StatusServiceUnavailable) && attempt < maxTTSRetries-1 {
			lastErr = fmt.Errorf("gemini TTS API error (status %d): %s", resp.StatusCode, string(body))
			continue
		}

		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("gemini TTS API error (status %d): %s", resp.StatusCode, string(body))
		}

		audioBase64, diagnostic, err := parseTTSAudioResponse(body)
		if err != nil {
			return "", fmt.Errorf("parse response: %w", err)
		}
		if audioBase64 == "" {
			lastErr = fmt.Errorf("Gemini returned no audio data: %s", diagnostic)
			if attempt < maxTTSRetries-1 {
				continue
			}
			return "", lastErr
		}

		return audioBase64, nil
	}
	return "", fmt.Errorf("TTS failed after %d retries: %w", maxTTSRetries, lastErr)
}

// StreamTTSChunk represents a single audio chunk from streaming TTS.
type StreamTTSChunk struct {
	AudioBase64 string `json:"audioBase64"`
	Index       int    `json:"index"`
	Done        bool   `json:"done"`
}

// GenerateTTSStream calls the Gemini streaming TTS endpoint and sends audio
// chunks to the provided channel as they arrive. The channel is closed when done.
func (c *Client) GenerateTTSStream(text, voiceName, systemInstruction, languageCode, model string, chunks chan<- StreamTTSChunk) error {
	defer close(chunks)

	spokenText := text
	if systemInstruction != "" {
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
		return fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/%s:streamGenerateContent?alt=sse&key=%s", baseURL, resolveTTSModel(model), c.apiKey)
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("gemini streaming TTS API error (status %d): %s", resp.StatusCode, string(body))
	}

	// Read SSE events from Gemini
	scanner := bufio.NewScanner(resp.Body)
	// Increase buffer size for large audio chunks
	scanner.Buffer(make([]byte, 0, 1024*1024), 10*1024*1024)
	idx := 0

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		jsonData := strings.TrimPrefix(line, "data: ")
		if jsonData == "" {
			continue
		}

		audioBase64, _, err := parseTTSAudioResponse([]byte(jsonData))
		if err != nil {
			slog.Warn("skip unparseable streaming chunk", "error", err)
			continue
		}
		if audioBase64 == "" {
			continue
		}

		chunks <- StreamTTSChunk{AudioBase64: audioBase64, Index: idx, Done: false}
		idx++
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("reading stream: %w", err)
	}

	chunks <- StreamTTSChunk{Done: true, Index: idx}
	return nil
}

// GenerateMultiSpeakerTTS calls Gemini TTS to generate multi-speaker dialogue audio.
// Each SpeakerConfig maps a speaker label (e.g. "Speaker1") to a Gemini voice name.
// The text should contain speaker labels like "Speaker1: Hello\nSpeaker2: Hi there".
func (c *Client) GenerateMultiSpeakerTTS(text string, speakers []SpeakerConfig, languageCode, model string) (string, error) {
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

	url := fmt.Sprintf("%s/models/%s:generateContent?key=%s", baseURL, resolveTTSModel(model), c.apiKey)

	var lastErr error
	for attempt := range maxTTSRetries {
		if attempt > 0 {
			slog.Warn("retrying multi-speaker TTS request", "attempt", attempt+1, "maxRetries", maxTTSRetries)
			time.Sleep(time.Duration(attempt) * time.Second)
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

		if resp.StatusCode == http.StatusInternalServerError || resp.StatusCode == http.StatusServiceUnavailable {
			lastErr = fmt.Errorf("gemini TTS API error (status %d): %s", resp.StatusCode, string(body))
			continue
		}
		if resp.StatusCode != http.StatusOK {
			return "", fmt.Errorf("gemini TTS API error (status %d): %s", resp.StatusCode, string(body))
		}

		audioBase64, diagnostic, err := parseTTSAudioResponse(body)
		if err != nil {
			return "", fmt.Errorf("parse response: %w", err)
		}
		if audioBase64 == "" {
			lastErr = fmt.Errorf("Gemini returned no audio data: %s", diagnostic)
			if attempt < maxTTSRetries-1 {
				continue
			}
			return "", lastErr
		}

		return audioBase64, nil
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

// FormatScript uses Gemini to reformat raw script text into optimised TTS
// prompt structure (Audio Profile → Scene → Director's Notes → Transcript).
func (c *Client) FormatScript(rawScript string) (string, error) {
	systemInstruction := `You are a professional TTS script formatter. Your task is to restructure raw text into an optimised prompt for a text-to-speech model.

Rules:
1. Keep all original content — do NOT add new sentences or remove existing ones.
2. Use this structure when appropriate:
   ## Audio Profile
   (voice description if implied by the text, otherwise omit)
   ## Scene
   (setting/context if applicable)
   ## Director's Notes
   (delivery guidance: tone, pacing, emphasis)
   ## Transcript
   (the actual words to speak, with audio tags where natural)
3. Insert audio tags like [whispers], [excited], [pause: 1s], [softly] where they naturally fit.
4. For very short or simple text, just return the text with minimal formatting — don't force structure.
5. Return ONLY the formatted script, no explanations or meta-commentary.`

	reqBody := map[string]any{
		"system_instruction": map[string]any{
			"parts": []map[string]any{
				{"text": systemInstruction},
			},
		},
		"contents": []map[string]any{
			{
				"parts": []map[string]any{
					{"text": rawScript},
				},
			},
		},
		"generationConfig": map[string]any{
			"temperature":     0.3,
			"maxOutputTokens": 4096,
		},
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/models/gemini-3-flash-preview:generateContent?key=%s", baseURL, c.apiKey)
	resp, err := c.httpClient.Post(url, "application/json", bytes.NewReader(data))
	if err != nil {
		return "", fmt.Errorf("http request: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		slog.Error("FormatScript API error", "status", resp.StatusCode, "body", string(body))
		return "", fmt.Errorf("Gemini API error (status %d)", resp.StatusCode)
	}

	var geminiResp struct {
		Candidates []struct {
			Content struct {
				Parts []struct {
					Text string `json:"text"`
				} `json:"parts"`
			} `json:"content"`
		} `json:"candidates"`
	}
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		return "", fmt.Errorf("unmarshal response: %w", err)
	}

	if len(geminiResp.Candidates) == 0 || len(geminiResp.Candidates[0].Content.Parts) == 0 {
		return "", fmt.Errorf("empty response from Gemini")
	}

	return geminiResp.Candidates[0].Content.Parts[0].Text, nil
}
