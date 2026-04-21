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

	t.Run("accepts relative image filenames inside cache", func(t *testing.T) {
		normalized, ok := normalizedCachedImagePath(cacheDir, "portrait.png")
		if !ok {
			t.Fatal("expected relative image path to be accepted")
		}
		expected := filepath.Join(cacheDir, "portrait.png")
		if normalized != expected {
			t.Fatalf("expected normalized path %q, got %q", expected, normalized)
		}
	})

	t.Run("rejects image traversal outside cache", func(t *testing.T) {
		if _, ok := normalizedCachedImagePath(cacheDir, filepath.Join("..", "portrait.png")); ok {
			t.Fatal("expected outside-cache image path to be rejected")
		}
	})
}
