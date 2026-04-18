// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"net/http"
	"os"
	"path/filepath"
)

// CacheHandler handles /api/cache endpoints for audio cache management.
type CacheHandler struct {
	AudioCacheDir string
}

// GetCacheStats returns the total size and file count of the audio cache.
func (h *CacheHandler) GetCacheStats(w http.ResponseWriter, r *http.Request) {
	var totalSize int64
	var fileCount int

	entries, err := os.ReadDir(h.AudioCacheDir)
	if err != nil {
		// If directory doesn't exist, cache is empty
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"total_size": 0,
			"file_count": 0,
			"cache_dir":  h.AudioCacheDir,
		})
		return
	}

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		info, err := entry.Info()
		if err != nil {
			continue
		}
		totalSize += info.Size()
		fileCount++
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"total_size": totalSize,
		"file_count": fileCount,
		"cache_dir":  h.AudioCacheDir,
	})
}

// ClearCache removes all files in the audio cache directory.
func (h *CacheHandler) ClearCache(w http.ResponseWriter, r *http.Request) {
	entries, err := os.ReadDir(h.AudioCacheDir)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]string{"status": "cleared"})
		return
	}

	var removed int
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		p := filepath.Join(h.AudioCacheDir, entry.Name())
		if os.Remove(p) == nil {
			removed++
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":  "cleared",
		"removed": removed,
	})
}
