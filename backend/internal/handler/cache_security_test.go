// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"path/filepath"
	"testing"
)

func TestNormalizedCachedAudioPath(t *testing.T) {
	cacheDir := t.TempDir()

	t.Run("accepts raw files inside cache", func(t *testing.T) {
		candidate := filepath.Join(cacheDir, "clip.raw")
		normalized, ok := normalizedCachedAudioPath(cacheDir, candidate)
		if !ok {
			t.Fatal("expected cache path to be accepted")
		}
		if normalized != candidate {
			t.Fatalf("expected normalized path %q, got %q", candidate, normalized)
		}
	})

	t.Run("rejects traversal outside cache", func(t *testing.T) {
		candidate := filepath.Join(cacheDir, "..", "secret.raw")
		if _, ok := normalizedCachedAudioPath(cacheDir, candidate); ok {
			t.Fatal("expected outside-cache path to be rejected")
		}
	})

	t.Run("rejects non raw extensions", func(t *testing.T) {
		candidate := filepath.Join(cacheDir, "notes.txt")
		if _, ok := normalizedCachedAudioPath(cacheDir, candidate); ok {
			t.Fatal("expected non-raw file to be rejected")
		}
	})
}
