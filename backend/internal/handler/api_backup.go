// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler - api_backup.go exposes database backup and restore endpoints.
package handler

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// BackupHandler handles /api/backup endpoints.
type BackupHandler struct {
	Store *store.Store
}

// CreateBackup creates a database backup and returns it as a download.
func (h *BackupHandler) CreateBackup(w http.ResponseWriter, r *http.Request) {
	// Create backup in a temp file
	tmpDir := os.TempDir()
	timestamp := time.Now().Format("20060102-150405")
	backupName := fmt.Sprintf("gemini-voice-backup-%s.db", timestamp)
	backupPath := filepath.Join(tmpDir, backupName)

	if err := h.Store.Backup(backupPath); err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create backup: "+err.Error())
		return
	}
	defer os.Remove(backupPath)

	// Send the backup file as a download
	f, err := os.Open(backupPath)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read backup file")
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to stat backup file")
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, backupName))
	w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size()))
	io.Copy(w, f)
}

// RestoreBackup restores a database from an uploaded backup file.
func (h *BackupHandler) RestoreBackup(w http.ResponseWriter, r *http.Request) {
	// Limit upload size to 100MB
	r.Body = http.MaxBytesReader(w, r.Body, 100<<20)

	file, _, err := r.FormFile("backup")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing backup file in form data")
		return
	}
	defer file.Close()

	// Write to temp file
	tmpFile, err := os.CreateTemp("", "gemini-voice-restore-*.db")
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create temp file")
		return
	}
	tmpPath := tmpFile.Name()
	defer os.Remove(tmpPath)

	if _, err := io.Copy(tmpFile, file); err != nil {
		tmpFile.Close()
		writeError(w, http.StatusBadRequest, "failed to read uploaded file")
		return
	}
	tmpFile.Close()

	// Restore from the temp file
	if err := h.Store.Restore(tmpPath); err != nil {
		writeError(w, http.StatusBadRequest, "restore failed: "+err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "restored"})
}
