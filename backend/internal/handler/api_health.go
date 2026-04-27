// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler implements shared HTTP helpers and endpoint handlers.
//
// api_health.go defines the health endpoint plus common JSON, error, decode,
// filename, and cache-path helpers reused by the other handler files.
package handler

import (
	"encoding/json"
	"net/http"
	"path/filepath"
	"regexp"
	"strings"
)

// Health returns server status.
func Health(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// writeJSON encodes v as JSON and writes it to the response.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

// writeError writes a JSON error response.
func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// decodeJSON reads and decodes JSON from the request body into v.
// Limits the body to 10 MB to prevent denial-of-service via large payloads.
func decodeJSON(r *http.Request, v any) error {
	r.Body = http.MaxBytesReader(nil, r.Body, 10<<20) // 10 MB
	defer r.Body.Close()
	return json.NewDecoder(r.Body).Decode(v)
}

// safeFilenameRe matches only safe characters for filenames.
var safeFilenameRe = regexp.MustCompile(`[^a-zA-Z0-9_-]`)

// sanitizeForFilename strips path separators, dots, and special characters
// from a user-supplied string so it is safe to use in a filename.
func sanitizeForFilename(s string) string {
	s = filepath.Base(s)
	s = strings.ReplaceAll(s, "..", "")
	s = safeFilenameRe.ReplaceAllString(s, "_")
	if s == "" || s == "." {
		s = "unknown"
	}
	return s
}

// safeCachePath builds a file path within cacheDir and validates the result
// hasn't escaped via path traversal.
func safeCachePath(cacheDir, filename string) (string, bool) {
	p := filepath.Join(cacheDir, filename)
	clean := filepath.Clean(p)
	if !strings.HasPrefix(clean, filepath.Clean(cacheDir)+string(filepath.Separator)) {
		return "", false
	}
	return clean, true
}
