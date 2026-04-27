// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store provides the SQLite-backed persistence layer.
//
// It manages schema migrations, WAL journaling, compatibility checks, and
// typed CRUD methods for config, API keys, history, presets, script projects,
// takes, pronunciation, cast profiles, clients, QC, provider mappings, export
// profiles, export jobs, and AI script-prep jobs.
package store

import (
	"database/sql"
	"embed"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strings"

	_ "modernc.org/sqlite"
)

//go:embed migrations/*.sql
var migrationsFS embed.FS

// Store wraps a SQLite database connection.
type Store struct {
	db     *sql.DB
	dbPath string
}

// New opens the SQLite database at the given path and runs migrations.
func New(dbPath string) (*Store, error) {
	// Ensure parent directory exists
	if err := os.MkdirAll(filepath.Dir(dbPath), 0o700); err != nil {
		return nil, fmt.Errorf("create db directory: %w", err)
	}

	db, err := openDatabase(dbPath)
	if err != nil {
		return nil, err
	}

	s := &Store{db: db, dbPath: dbPath}
	if err := s.prepareDatabase(); err != nil {
		db.Close()
		return nil, err
	}

	return s, nil
}

// Close closes the underlying database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

// DBPath returns the path to the SQLite database file.
func (s *Store) DBPath() string {
	return s.dbPath
}

// Backup creates a consistent backup of the database using VACUUM INTO.
func (s *Store) Backup(destPath string) error {
	// Ensure destination directory exists
	if err := os.MkdirAll(filepath.Dir(destPath), 0o700); err != nil {
		return fmt.Errorf("create backup directory: %w", err)
	}
	// Remove destination if it already exists (VACUUM INTO requires it not exist)
	os.Remove(destPath)
	_, err := s.db.Exec("VACUUM INTO ?", destPath)
	if err != nil {
		return fmt.Errorf("vacuum into: %w", err)
	}
	return nil
}

// Restore replaces the current database with a backup file.
// The caller must restart the server after calling this.
func (s *Store) Restore(srcPath string) error {
	candidateDB, err := openDatabase(srcPath)
	if err != nil {
		return fmt.Errorf("open backup database: %w", err)
	}
	if err := prepareDatabase(candidateDB); err != nil {
		candidateDB.Close()
		return fmt.Errorf("backup file is not compatible: %w", err)
	}
	candidateDB.Close()

	// Close current database
	s.db.Close()

	// Replace the database file
	srcData, err := os.ReadFile(srcPath)
	if err != nil {
		return fmt.Errorf("read backup file: %w", err)
	}
	if err := os.WriteFile(s.dbPath, srcData, 0o600); err != nil {
		return fmt.Errorf("write database file: %w", err)
	}

	// Remove WAL and SHM files if present
	os.Remove(s.dbPath + "-wal")
	os.Remove(s.dbPath + "-shm")

	// Reopen database
	db, err := openDatabase(s.dbPath)
	if err != nil {
		return fmt.Errorf("reopen database: %w", err)
	}
	s.db = db
	if err := s.prepareDatabase(); err != nil {
		db.Close()
		return fmt.Errorf("prepare restored database: %w", err)
	}
	return nil
}

// DB returns the underlying sql.DB for use in handlers if needed.
func (s *Store) DB() *sql.DB {
	return s.db
}

// openDatabase opens SQLite with the pragmas that need to be encoded into the DSN.
func openDatabase(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	return db, nil
}

// prepareDatabase enables required pragmas, runs migrations, applies compatibility
// columns for older databases, and verifies that the expected schema is present.
func prepareDatabase(db *sql.DB) error {
	if _, err := db.Exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;"); err != nil {
		return fmt.Errorf("set pragmas: %w", err)
	}
	if err := migrateDB(db); err != nil {
		return fmt.Errorf("run migrations: %w", err)
	}

	// Add columns that older databases may not have.
	addColumnIfMissing(db, "custom_presets", "color", "TEXT NOT NULL DEFAULT '#6366f1'")
	addColumnIfMissing(db, "custom_presets", "sort_order", "INTEGER NOT NULL DEFAULT 0")
	// Migration 012: audio analysis metadata on segment_takes.
	addColumnIfMissing(db, "segment_takes", "peak_dbfs", "REAL")
	addColumnIfMissing(db, "segment_takes", "rms_dbfs", "REAL")
	addColumnIfMissing(db, "segment_takes", "clipping_detected", "INTEGER NOT NULL DEFAULT 0")
	addColumnIfMissing(db, "segment_takes", "sample_rate", "INTEGER")
	addColumnIfMissing(db, "segment_takes", "channels", "INTEGER")
	addColumnIfMissing(db, "segment_takes", "format", "TEXT")
	// Migration 015: cast profile assignment on script_segments.
	addColumnIfMissing(db, "script_segments", "cast_profile_id", "INTEGER")
	// Migration 018: client workspace linkage.
	addColumnIfMissing(db, "script_projects", "client_id", "INTEGER REFERENCES clients(id) ON DELETE SET NULL")
	addColumnIfMissing(db, "pronunciation_dictionaries", "client_id", "INTEGER REFERENCES clients(id) ON DELETE SET NULL")
	// Migration 019: provider strategy and reproducibility metadata.
	addColumnIfMissing(db, "script_projects", "fallback_provider", "TEXT")
	addColumnIfMissing(db, "script_projects", "fallback_model", "TEXT")
	addColumnIfMissing(db, "script_segments", "fallback_provider", "TEXT")
	addColumnIfMissing(db, "script_segments", "fallback_model", "TEXT")
	addColumnIfMissing(db, "clients", "fallback_provider", "TEXT")
	addColumnIfMissing(db, "clients", "fallback_model", "TEXT")
	addColumnIfMissing(db, "segment_takes", "provider_voice", "TEXT")
	addColumnIfMissing(db, "segment_takes", "app_voice_name", "TEXT")
	addColumnIfMissing(db, "segment_takes", "preset_id", "INTEGER")
	addColumnIfMissing(db, "segment_takes", "style_id", "INTEGER")
	addColumnIfMissing(db, "segment_takes", "accent_id", "TEXT")
	addColumnIfMissing(db, "segment_takes", "cast_profile_id", "INTEGER")
	addColumnIfMissing(db, "segment_takes", "dictionary_hash", "TEXT")
	addColumnIfMissing(db, "segment_takes", "prompt_hash", "TEXT")
	addColumnIfMissing(db, "segment_takes", "settings_json", "TEXT")

	if err := validateSchema(db); err != nil {
		return fmt.Errorf("validate schema: %w", err)
	}

	return nil
}

// prepareDatabase runs database preparation against this Store's connection.
func (s *Store) prepareDatabase() error {
	return prepareDatabase(s.db)
}

// migrateDB reads embedded SQL files and executes them in order.
func migrateDB(db *sql.DB) error {
	entries, err := migrationsFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	// Sort by filename to ensure order
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".sql") {
			continue
		}

		data, err := migrationsFS.ReadFile("migrations/" + entry.Name())
		if err != nil {
			return fmt.Errorf("read migration %s: %w", entry.Name(), err)
		}

		slog.Info("applying migration", "file", entry.Name())
		if _, err := db.Exec(string(data)); err != nil {
			return fmt.Errorf("execute migration %s: %w", entry.Name(), err)
		}
	}

	return nil
}

// addColumnIfMissing adds a column to a table if it doesn't already exist.
func addColumnIfMissing(db *sql.DB, table, column, colDef string) {
	// Check if column exists via PRAGMA
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		slog.Warn("failed to check table info", "table", table, "error", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull int
		var dflt *string
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			continue
		}
		if strings.EqualFold(name, column) {
			return // column already exists
		}
	}

	stmt := fmt.Sprintf("ALTER TABLE %s ADD COLUMN %s %s", table, column, colDef)
	if _, err := db.Exec(stmt); err != nil {
		slog.Warn("failed to add column", "table", table, "column", column, "error", err)
	} else {
		slog.Info("added column", "table", table, "column", column)
	}
}

// validateSchema verifies the minimum table/column contract expected by handlers.
func validateSchema(db *sql.DB) error {
	required := map[string][]string{
		"api_keys":                          {"id", "provider", "encrypted", "nonce"},
		"config":                            {"key", "value"},
		"history":                           {"id", "type", "voice_name", "input_text", "result_json", "audio_path", "created_at"},
		"voices":                            {"name", "pitch", "gender", "characteristics", "audio_sample_url", "file_uri", "analysis_json", "image_url"},
		"custom_presets":                    {"id", "name", "voice_name", "system_instruction", "sample_text", "audio_path", "source_query", "metadata_json", "color", "sort_order", "created_at", "updated_at"},
		"favorites":                         {"voice_name", "created_at"},
		"preset_tags":                       {"id", "preset_id", "tag", "color"},
		"preset_versions":                   {"id", "preset_id", "name", "voice_name", "system_instruction", "sample_text", "color", "metadata_json", "created_at"},
		"api_key_pool":                      {"id", "provider", "label", "encrypted", "nonce", "is_active", "error_count", "last_used_at", "created_at", "updated_at"},
		"jobs":                              {"id", "job_type", "status", "project_id", "section_id", "segment_id", "total_items", "completed_items", "failed_items", "percent", "message", "error", "error_code", "metadata_json", "created_at", "updated_at", "completed_at"},
		"job_items":                         {"id", "job_id", "segment_id", "status", "attempt_count", "last_error", "sort_order", "created_at", "updated_at"},
		"script_projects":                   {"id", "title", "kind", "description", "status", "default_voice_name", "default_preset_id", "default_style_id", "default_accent_id", "default_language_code", "default_provider", "default_model", "fallback_provider", "fallback_model", "client_id", "metadata_json", "created_at", "updated_at"},
		"script_sections":                   {"id", "project_id", "parent_id", "kind", "title", "sort_order", "metadata_json", "created_at", "updated_at"},
		"script_segments":                   {"id", "project_id", "section_id", "title", "script_text", "speaker_label", "voice_name", "cast_profile_id", "preset_id", "style_id", "accent_id", "language_code", "provider", "model", "fallback_provider", "fallback_model", "status", "content_hash", "sort_order", "metadata_json", "created_at", "updated_at"},
		"segment_takes":                     {"id", "project_id", "segment_id", "take_number", "voice_name", "speaker_label", "language_code", "provider", "model", "provider_voice", "app_voice_name", "preset_id", "style_id", "accent_id", "cast_profile_id", "dictionary_hash", "prompt_hash", "settings_json", "system_instruction", "script_text", "audio_path", "duration_seconds", "peak_dbfs", "rms_dbfs", "clipping_detected", "sample_rate", "channels", "format", "content_hash", "status", "metadata_json", "created_at"},
		"take_notes":                        {"id", "take_id", "note", "created_at"},
		"pronunciation_dictionaries":        {"id", "project_id", "name", "created_at", "updated_at"},
		"pronunciation_entries":             {"id", "dictionary_id", "raw_word", "replacement", "is_regex", "enabled", "sort_order", "created_at", "updated_at"},
		"global_pronunciation_dictionaries": {"id", "name", "created_at", "updated_at"},
		"global_pronunciation_entries":      {"id", "dictionary_id", "raw_word", "replacement", "is_regex", "enabled", "sort_order", "created_at", "updated_at"},
		"export_profiles":                   {"id", "name", "target_kind", "trim_silence", "silence_threshold_db", "leading_silence_ms", "trailing_silence_ms", "inter_segment_silence_ms", "normalize_peak_db", "is_builtin", "metadata_json", "created_at", "updated_at"},
		"cast_profiles":                     {"id", "project_id", "series_id", "name", "role", "description", "voice_name", "preset_id", "style_id", "accent_id", "language_code", "age_impression", "emotional_range", "sample_lines_json", "pronunciation_notes", "metadata_json", "sort_order", "created_at", "updated_at"},
		"cast_profile_versions":             {"id", "profile_id", "name", "role", "description", "voice_name", "preset_id", "style_id", "accent_id", "language_code", "age_impression", "emotional_range", "sample_lines_json", "pronunciation_notes", "metadata_json", "sort_order", "created_at"},
		"provider_voice_mappings":           {"id", "project_id", "source_provider", "source_voice", "target_provider", "target_voice", "notes", "created_at", "updated_at"},
		"export_jobs":                       {"id", "project_id", "export_profile_id", "status", "output_path", "error", "metadata_json", "created_at", "updated_at"},
		"export_job_items":                  {"id", "export_job_id", "asset_type", "asset_id", "output_name", "status", "error"},
		"script_prep_jobs":                  {"id", "project_id", "raw_script_hash", "raw_script", "result_json", "status", "error", "created_at", "updated_at"},
	}

	for table, columns := range required {
		available, err := tableColumns(db, table)
		if err != nil {
			return err
		}
		for _, column := range columns {
			if _, ok := available[column]; !ok {
				return fmt.Errorf("missing required column %s.%s", table, column)
			}
		}
	}

	return nil
}

// tableColumns returns lower-cased column names for a required SQLite table.
func tableColumns(db *sql.DB, table string) (map[string]struct{}, error) {
	rows, err := db.Query(fmt.Sprintf("PRAGMA table_info(%s)", table))
	if err != nil {
		return nil, fmt.Errorf("inspect table %s: %w", table, err)
	}
	defer rows.Close()

	columns := map[string]struct{}{}
	for rows.Next() {
		var cid int
		var name, ctype string
		var notnull int
		var dflt *string
		var pk int
		if err := rows.Scan(&cid, &name, &ctype, &notnull, &dflt, &pk); err != nil {
			return nil, fmt.Errorf("scan table info for %s: %w", table, err)
		}
		columns[strings.ToLower(name)] = struct{}{}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate table info for %s: %w", table, err)
	}
	if len(columns) == 0 {
		return nil, fmt.Errorf("missing required table %s", table)
	}

	return columns, nil
}
