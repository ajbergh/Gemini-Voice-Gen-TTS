// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package pronunciation

import (
	"testing"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

func entry(raw, replacement string, isRegex, enabled bool) store.PronunciationEntry {
	return store.PronunciationEntry{
		RawWord:     raw,
		Replacement: replacement,
		IsRegex:     isRegex,
		Enabled:     enabled,
	}
}

func TestApplyDictionary(t *testing.T) {
	cases := []struct {
		name    string
		text    string
		entries []store.PronunciationEntry
		want    string
	}{
		{
			name:    "plain whole-word replacement",
			text:    "I love GIF files and gif art.",
			entries: []store.PronunciationEntry{entry("GIF", "JIF", false, true)},
			want:    "I love JIF files and JIF art.",
		},
		{
			name:    "plain word not partial-matched",
			text:    "GIFFY is not a GIF.",
			entries: []store.PronunciationEntry{entry("GIF", "JIF", false, true)},
			want:    "GIFFY is not a JIF.",
		},
		{
			name:    "disabled entry skipped",
			text:    "Hello GIF.",
			entries: []store.PronunciationEntry{entry("GIF", "JIF", false, false)},
			want:    "Hello GIF.",
		},
		{
			name: "regex replacement",
			text: "See Dr. Smith and Dr Jones.",
			entries: []store.PronunciationEntry{
				entry(`Dr\.?\s*`, "Doctor ", true, true),
			},
			want: "See Doctor Smith and Doctor Jones.",
		},
		{
			name:    "invalid regex skipped silently",
			text:    "Hello world.",
			entries: []store.PronunciationEntry{entry(`[invalid`, "x", true, true)},
			want:    "Hello world.",
		},
		{
			name: "entries applied in order",
			text: "foo",
			entries: []store.PronunciationEntry{
				entry("foo", "bar", false, true),
				entry("bar", "baz", false, true),
			},
			want: "baz",
		},
		{
			name:    "empty entries returns original",
			text:    "no change",
			entries: nil,
			want:    "no change",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := ApplyDictionary(tc.text, tc.entries)
			if got != tc.want {
				t.Errorf("got %q, want %q", got, tc.want)
			}
		})
	}
}

func TestPreview(t *testing.T) {
	entries := []store.PronunciationEntry{
		entry("GIF", "JIF", false, true),
		entry("no-match", "x", false, true),
	}
	result, changed := Preview("I love GIF files.", entries)
	if result != "I love JIF files." {
		t.Errorf("unexpected result: %q", result)
	}
	if changed != 1 {
		t.Errorf("expected 1 changed rule, got %d", changed)
	}
}
