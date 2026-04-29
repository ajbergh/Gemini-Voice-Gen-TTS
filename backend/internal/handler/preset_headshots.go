// Copyright 2026 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler - preset_headshots.go manages preset metadata and generated
// portrait/headshot cache files.
package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/gemini"
)

const (
	headshotStatusReady       = "ready"
	headshotStatusFailed      = "failed"
	headshotAspectRatio       = "1:1"
	headshotImageSize         = "1K"
	defaultHeadshotImageModel = "gemini-3.1-flash-image-preview"
	headshotPromptModifier    = "Professional portrait headshot, studio photography, 85mm lens, soft professional lighting, neutral gradient background, sharp focus on eyes, high-end commercial quality, clean skin textures"
)

type presetMetadata struct {
	CastingDirector *presetCastingDirectorMetadata `json:"castingDirector,omitempty"`
	Headshot        *presetHeadshotMetadata        `json:"headshot,omitempty"`
}

type presetCastingDirectorMetadata struct {
	SourceQuery       string `json:"sourceQuery,omitempty"`
	PersonDescription string `json:"personDescription,omitempty"`
}

type presetHeadshotMetadata struct {
	Status      string `json:"status,omitempty"`
	Prompt      string `json:"prompt,omitempty"`
	MimeType    string `json:"mimeType,omitempty"`
	Path        string `json:"path,omitempty"`
	Error       string `json:"error,omitempty"`
	GeneratedAt string `json:"generatedAt,omitempty"`
	AspectRatio string `json:"aspectRatio,omitempty"`
	ImageSize   string `json:"imageSize,omitempty"`
	Model       string `json:"model,omitempty"`
}

// parsePresetMetadata reads the optional metadata_json payload stored on presets.
func parsePresetMetadata(raw *string) (presetMetadata, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return presetMetadata{}, nil
	}

	var metadata presetMetadata
	if err := json.Unmarshal([]byte(*raw), &metadata); err != nil {
		return presetMetadata{}, err
	}
	return metadata, nil
}

// marshalPresetMetadata serializes metadata or returns nil when it has no content.
func marshalPresetMetadata(metadata presetMetadata) (*string, error) {
	if metadata.CastingDirector == nil && metadata.Headshot == nil {
		return nil, nil
	}

	data, err := json.Marshal(metadata)
	if err != nil {
		return nil, err
	}
	value := string(data)
	return &value, nil
}

// buildHeadshotPrompt converts casting metadata into the Gemini image prompt.
func buildHeadshotPrompt(personDescription string) string {
	description := strings.TrimSpace(personDescription)
	description = strings.TrimRight(description, ".!?,;: ")
	if description == "" {
		return ""
	}
	return "1:1 size. " + description + ". " + headshotPromptModifier
}

// safeHeadshotErrorMessage trims provider errors before persisting metadata.
func safeHeadshotErrorMessage(err error) string {
	if err == nil {
		return ""
	}
	message := strings.TrimSpace(err.Error())
	if len(message) > 240 {
		message = message[:237] + "..."
	}
	return message
}

// applyHeadshotFailure records a failed image-generation attempt in metadata.
func applyHeadshotFailure(metadata *presetMetadata, prompt string, err error) {
	metadata.Headshot = &presetHeadshotMetadata{
		Status: headshotStatusFailed,
		Prompt: prompt,
		Error:  safeHeadshotErrorMessage(err),
	}
}

// applyHeadshotSuccess records the generated image details in preset metadata.
func applyHeadshotSuccess(metadata *presetMetadata, prompt, mimeType, path string) {
	metadata.Headshot = &presetHeadshotMetadata{
		Status:      headshotStatusReady,
		Prompt:      prompt,
		MimeType:    mimeType,
		Path:        path,
		GeneratedAt: time.Now().UTC().Format(time.RFC3339),
		AspectRatio: headshotAspectRatio,
		ImageSize:   headshotImageSize,
		Model:       defaultHeadshotImageModel,
	}
}

// mergePresetMetadata preserves existing headshot data while updating casting context.
func mergePresetMetadata(existing *string, sourceQuery, personDescription string) (presetMetadata, error) {
	metadata, err := parsePresetMetadata(existing)
	if err != nil {
		return presetMetadata{}, err
	}

	sourceQuery = strings.TrimSpace(sourceQuery)
	personDescription = strings.TrimSpace(personDescription)
	if sourceQuery != "" || personDescription != "" {
		if metadata.CastingDirector == nil {
			metadata.CastingDirector = &presetCastingDirectorMetadata{}
		}
		if sourceQuery != "" {
			metadata.CastingDirector.SourceQuery = sourceQuery
		}
		if personDescription != "" {
			metadata.CastingDirector.PersonDescription = personDescription
		}
	}

	return metadata, nil
}

// imageExtensionForMimeType maps supported generated image MIME types to file extensions.
func imageExtensionForMimeType(mimeType string) (string, error) {
	baseType := strings.ToLower(strings.TrimSpace(strings.Split(mimeType, ";")[0]))
	switch baseType {
	case "image/png":
		return ".png", nil
	case "image/jpeg":
		return ".jpg", nil
	case "image/webp":
		return ".webp", nil
	default:
		return "", fmt.Errorf("unsupported generated image MIME type %q", mimeType)
	}
}

// normalizeHeadshotMimeType trusts the provider MIME type when supported, then sniffs bytes.
func normalizeHeadshotMimeType(mimeType string, imageBytes []byte) (string, string, error) {
	baseType := strings.ToLower(strings.TrimSpace(strings.Split(mimeType, ";")[0]))
	extension, err := imageExtensionForMimeType(baseType)
	if err == nil {
		return baseType, extension, nil
	}

	detected := strings.ToLower(strings.TrimSpace(strings.Split(http.DetectContentType(imageBytes), ";")[0]))
	extension, err = imageExtensionForMimeType(detected)
	if err != nil {
		return "", "", err
	}
	return detected, extension, nil
}

// cachePresetHeadshot validates and writes a generated preset image into the media cache.
func cachePresetHeadshot(cacheDir, presetName, voiceName, mimeType string, imageBytes []byte) (string, string, error) {
	if strings.TrimSpace(cacheDir) == "" {
		return "", "", fmt.Errorf("cache directory is not configured")
	}

	normalizedMimeType, extension, err := normalizeHeadshotMimeType(mimeType, imageBytes)
	if err != nil {
		return "", "", err
	}

	safeName := sanitizeForFilename(strings.TrimSpace(presetName))
	if safeName == "unknown" && strings.TrimSpace(voiceName) != "" {
		safeName = sanitizeForFilename(voiceName)
	}
	filename := fmt.Sprintf("preset_image_%d_%s%s", time.Now().UnixMilli(), safeName, extension)
	cachePath, ok := safeCachePath(cacheDir, filename)
	if !ok {
		return "", "", fmt.Errorf("invalid preset image cache path")
	}

	if err := os.WriteFile(cachePath, imageBytes, 0o600); err != nil {
		return "", "", fmt.Errorf("write cached image: %w", err)
	}

	return filename, normalizedMimeType, nil
}

// headshotMetadataFromRaw extracts usable headshot metadata from metadata_json.
func headshotMetadataFromRaw(raw *string) (*presetHeadshotMetadata, error) {
	metadata, err := parsePresetMetadata(raw)
	if err != nil {
		return nil, err
	}
	if metadata.Headshot == nil || strings.TrimSpace(metadata.Headshot.Path) == "" {
		return nil, nil
	}
	return metadata.Headshot, nil
}

// removePresetHeadshot deletes a cached headshot referenced by preset metadata.
func removePresetHeadshot(cacheDir string, raw *string) error {
	headshot, err := headshotMetadataFromRaw(raw)
	if err != nil {
		return err
	}
	if headshot == nil {
		return nil
	}
	return removeCachedImageFile(cacheDir, headshot.Path)
}

// portablePresetMetadata strips cache-local headshot fields so metadata can be
// safely exported or imported without dangling file references.
func portablePresetMetadata(raw *string) *string {
	metadata, err := parsePresetMetadata(raw)
	if err != nil {
		return raw
	}

	metadata.Headshot = nil
	portable, err := marshalPresetMetadata(metadata)
	if err != nil {
		return raw
	}
	return portable
}

// buildPresetMetadata merges casting metadata and optionally generates a cached headshot.
func (h *PresetsHandler) buildPresetMetadata(existing *string, sourceQuery, personDescription string, generateHeadshot bool, presetName, voiceName string) (*string, string, error) {
	metadata, err := mergePresetMetadata(existing, sourceQuery, personDescription)
	if err != nil {
		return nil, "", fmt.Errorf("invalid metadata_json: %w", err)
	}

	personDescription = strings.TrimSpace(personDescription)
	if !generateHeadshot || personDescription == "" {
		metadataJSON, err := marshalPresetMetadata(metadata)
		return metadataJSON, "", err
	}

	prompt := buildHeadshotPrompt(personDescription)
	if prompt == "" {
		metadataJSON, err := marshalPresetMetadata(metadata)
		return metadataJSON, "", err
	}

	if h.KeysHandler == nil {
		applyHeadshotFailure(&metadata, prompt, fmt.Errorf("Gemini image generation is not configured on the server"))
		metadataJSON, err := marshalPresetMetadata(metadata)
		return metadataJSON, "", err
	}

	apiKey, err := h.KeysHandler.GetDecryptedKey("gemini")
	if err != nil {
		applyHeadshotFailure(&metadata, prompt, fmt.Errorf("no Gemini API key configured"))
		metadataJSON, marshalErr := marshalPresetMetadata(metadata)
		return metadataJSON, "", marshalErr
	}

	client := gemini.NewClient(apiKey)
	imageBytes, mimeType, genErr := client.GenerateHeadshot(prompt, "")
	if genErr != nil {
		applyHeadshotFailure(&metadata, prompt, genErr)
		metadataJSON, marshalErr := marshalPresetMetadata(metadata)
		return metadataJSON, "", marshalErr
	}

	cachePath, normalizedMimeType, cacheErr := cachePresetHeadshot(h.AudioCacheDir, presetName, voiceName, mimeType, imageBytes)
	if cacheErr != nil {
		applyHeadshotFailure(&metadata, prompt, cacheErr)
		metadataJSON, marshalErr := marshalPresetMetadata(metadata)
		return metadataJSON, "", marshalErr
	}

	applyHeadshotSuccess(&metadata, prompt, normalizedMimeType, cachePath)
	metadataJSON, marshalErr := marshalPresetMetadata(metadata)
	if marshalErr != nil {
		_ = removeCachedImageFile(h.AudioCacheDir, cachePath)
		return nil, "", marshalErr
	}

	return metadataJSON, cachePath, nil
}
