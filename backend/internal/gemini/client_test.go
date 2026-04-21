// Copyright 2026 ajbergh
// SPDX-License-Identifier: Apache-2.0

package gemini

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"
)

func TestParseTTSAudioResponseFindsAudioInLaterPart(t *testing.T) {
	body := []byte(`{
		"candidates": [
			{
				"content": {
					"parts": [
						{"text": "Preparing audio."},
						{"inlineData": {"mimeType": "audio/L16;rate=24000", "data": "AQID"}}
					]
				}
			}
		]
	}`)

	audioBase64, diagnostic, err := parseTTSAudioResponse(body)
	if err != nil {
		t.Fatalf("parseTTSAudioResponse returned error: %v", err)
	}
	if audioBase64 != "AQID" {
		t.Fatalf("expected audio base64 AQID, got %q", audioBase64)
	}
	if diagnostic != "" {
		t.Fatalf("expected empty diagnostic for audio response, got %q", diagnostic)
	}
}

func TestParseTTSAudioResponseReportsTextOnlyResponse(t *testing.T) {
	body := []byte(`{
		"candidates": [
			{
				"finishReason": "STOP",
				"content": {
					"parts": [
						{"text": "I could not generate audio for that request."}
					]
				}
			}
		]
	}`)

	audioBase64, diagnostic, err := parseTTSAudioResponse(body)
	if err != nil {
		t.Fatalf("parseTTSAudioResponse returned error: %v", err)
	}
	if audioBase64 != "" {
		t.Fatalf("expected no audio data, got %q", audioBase64)
	}
	if !strings.Contains(diagnostic, "finish reasons: STOP") {
		t.Fatalf("expected finish reason in diagnostic, got %q", diagnostic)
	}
	if !strings.Contains(diagnostic, "text parts: I could not generate audio for that request.") {
		t.Fatalf("expected text response in diagnostic, got %q", diagnostic)
	}
}

func TestParseImageResponsePrefersFinalNonThoughtImage(t *testing.T) {
	thoughtImage := base64.StdEncoding.EncodeToString([]byte("thought-image"))
	finalImage := base64.StdEncoding.EncodeToString([]byte("final-image"))
	body := []byte(`{
		"candidates": [
			{
				"content": {
					"parts": [
						{"inlineData": {"mimeType": "image/png", "data": "` + thoughtImage + `"}, "thought": true},
						{"inlineData": {"mimeType": "image/png", "data": "` + finalImage + `"}}
					]
				}
			}
		]
	}`)

	imageBytes, mimeType, diagnostic, err := parseImageResponse(body)
	if err != nil {
		t.Fatalf("parseImageResponse returned error: %v", err)
	}
	if mimeType != "image/png" {
		t.Fatalf("expected image/png mime type, got %q", mimeType)
	}
	if !bytes.Equal(imageBytes, []byte("final-image")) {
		t.Fatalf("expected final image bytes, got %q", string(imageBytes))
	}
	if diagnostic != "" {
		t.Fatalf("expected empty diagnostic for image response, got %q", diagnostic)
	}
}

func TestParseImageResponseReportsMissingImage(t *testing.T) {
	body := []byte(`{
		"candidates": [
			{
				"finishReason": "NO_IMAGE",
				"content": {
					"parts": [
						{"text": "I could not create an image for that request."}
					]
				}
			}
		],
		"promptFeedback": {
			"blockReason": "IMAGE_SAFETY"
		}
	}`)

	imageBytes, mimeType, diagnostic, err := parseImageResponse(body)
	if err != nil {
		t.Fatalf("parseImageResponse returned error: %v", err)
	}
	if len(imageBytes) != 0 {
		t.Fatalf("expected no image bytes, got %q", string(imageBytes))
	}
	if mimeType != "" {
		t.Fatalf("expected empty mime type, got %q", mimeType)
	}
	if !strings.Contains(diagnostic, "prompt blocked: IMAGE_SAFETY") {
		t.Fatalf("expected prompt block in diagnostic, got %q", diagnostic)
	}
	if !strings.Contains(diagnostic, "finish reasons: NO_IMAGE") {
		t.Fatalf("expected finish reason in diagnostic, got %q", diagnostic)
	}
}
