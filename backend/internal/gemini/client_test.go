// Copyright 2026 ajbergh
// SPDX-License-Identifier: Apache-2.0

package gemini

import (
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
