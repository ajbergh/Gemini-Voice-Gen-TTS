// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package pronunciation provides text preprocessing for TTS render pipelines.
// ApplyDictionary replaces words in the input text according to a slice of
// PronunciationEntry rules, applied in order.  Plain-text replacements are
// case-insensitive whole-word matches; regex replacements use the entry's
// raw_word value as a Go regexp pattern.
package pronunciation

import (
	"regexp"
	"strings"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// ApplyDictionary runs all enabled entries against text and returns the
// transformed result.  Entries are applied in the order they are provided
// (callers should pass them pre-sorted by sort_order).
func ApplyDictionary(text string, entries []store.PronunciationEntry) string {
	for _, e := range entries {
		if !e.Enabled {
			continue
		}
		if e.IsRegex {
			text = applyRegex(text, e.RawWord, e.Replacement)
		} else {
			text = applyWord(text, e.RawWord, e.Replacement)
		}
	}
	return text
}

// applyWord replaces whole-word occurrences of raw (case-insensitive) with
// replacement, preserving surrounding non-word characters.
func applyWord(text, raw, replacement string) string {
	// Build a case-insensitive whole-word regexp on the fly.
	// QuoteMeta ensures any special chars in the literal word are escaped.
	pattern := `(?i)\b` + regexp.QuoteMeta(raw) + `\b`
	re, err := regexp.Compile(pattern)
	if err != nil {
		// Malformed pattern (shouldn't happen with QuoteMeta) — skip silently.
		return text
	}
	return re.ReplaceAllString(text, replacement)
}

// applyRegex compiles raw as a Go regexp and replaces all matches with
// replacement.  Invalid patterns are skipped silently so a single bad entry
// does not break the whole pipeline.
func applyRegex(text, raw, replacement string) string {
	re, err := regexp.Compile(raw)
	if err != nil {
		return text
	}
	return re.ReplaceAllString(text, replacement)
}

// Preview returns the transformed text along with the number of rules that
// actually changed it — useful for the frontend preview endpoint.
func Preview(text string, entries []store.PronunciationEntry) (result string, changed int) {
	result = text
	for _, e := range entries {
		if !e.Enabled {
			continue
		}
		var next string
		if e.IsRegex {
			next = applyRegex(result, e.RawWord, e.Replacement)
		} else {
			next = applyWord(result, e.RawWord, e.Replacement)
		}
		if !strings.EqualFold(next, result) {
			changed++
		}
		result = next
	}
	return result, changed
}
