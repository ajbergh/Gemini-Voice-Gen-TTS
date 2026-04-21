// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"fmt"
	"os"
	"path/filepath"
	"slices"
	"strings"
)

// normalizedCachedFilePath validates a stored cache path before reading or removing it.
// Database contents are treated as untrusted because they can be restored from backups.
func normalizedCachedFilePath(cacheDir, storedPath string, allowedExtensions ...string) (string, bool) {
	if strings.TrimSpace(cacheDir) == "" || strings.TrimSpace(storedPath) == "" {
		return "", false
	}

	absCacheDir, err := filepath.Abs(filepath.Clean(cacheDir))
	if err != nil {
		return "", false
	}
	candidatePath := filepath.Clean(storedPath)
	if !filepath.IsAbs(candidatePath) {
		candidatePath = filepath.Join(absCacheDir, candidatePath)
	}
	absStoredPath, err := filepath.Abs(candidatePath)
	if err != nil {
		return "", false
	}

	rel, err := filepath.Rel(absCacheDir, absStoredPath)
	if err != nil {
		return "", false
	}
	if rel == "." || rel == "" || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return "", false
	}
	ext := strings.ToLower(filepath.Ext(absStoredPath))
	normalizedAllowed := make([]string, len(allowedExtensions))
	for i, allowed := range allowedExtensions {
		normalizedAllowed[i] = strings.ToLower(allowed)
	}
	if len(normalizedAllowed) > 0 && !slices.Contains(normalizedAllowed, ext) {
		return "", false
	}

	return absStoredPath, true
}

// normalizedCachedAudioPath validates a stored audio path before reading or removing it.
func normalizedCachedAudioPath(cacheDir, storedPath string) (string, bool) {
	return normalizedCachedFilePath(cacheDir, storedPath, ".raw")
}

// normalizedCachedImagePath validates a stored image path before reading or removing it.
func normalizedCachedImagePath(cacheDir, storedPath string) (string, bool) {
	return normalizedCachedFilePath(cacheDir, storedPath, ".png", ".jpg", ".jpeg", ".webp")
}

func readCachedAudioFile(cacheDir, storedPath string) ([]byte, error) {
	safePath, ok := normalizedCachedAudioPath(cacheDir, storedPath)
	if !ok {
		return nil, fmt.Errorf("invalid cached audio path")
	}
	return os.ReadFile(safePath)
}

func removeCachedAudioFile(cacheDir, storedPath string) error {
	safePath, ok := normalizedCachedAudioPath(cacheDir, storedPath)
	if !ok {
		return fmt.Errorf("invalid cached audio path")
	}
	return os.Remove(safePath)
}

func readCachedImageFile(cacheDir, storedPath string) ([]byte, error) {
	safePath, ok := normalizedCachedImagePath(cacheDir, storedPath)
	if !ok {
		return nil, fmt.Errorf("invalid cached image path")
	}
	return os.ReadFile(safePath)
}

func removeCachedImageFile(cacheDir, storedPath string) error {
	safePath, ok := normalizedCachedImagePath(cacheDir, storedPath)
	if !ok {
		return fmt.Errorf("invalid cached image path")
	}
	return os.Remove(safePath)
}
