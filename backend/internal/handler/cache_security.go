// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// normalizedCachedAudioPath validates a stored audio path before reading or removing it.
// Database contents are treated as untrusted because they can be restored from backups.
func normalizedCachedAudioPath(cacheDir, storedPath string) (string, bool) {
	if strings.TrimSpace(cacheDir) == "" || strings.TrimSpace(storedPath) == "" {
		return "", false
	}

	absCacheDir, err := filepath.Abs(filepath.Clean(cacheDir))
	if err != nil {
		return "", false
	}
	absStoredPath, err := filepath.Abs(filepath.Clean(storedPath))
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
	if !strings.EqualFold(filepath.Ext(absStoredPath), ".raw") {
		return "", false
	}

	return absStoredPath, true
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
