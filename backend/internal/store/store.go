// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store provides a SQLite-backed persistence layer using
// modernc.org/sqlite (pure Go, no CGo). It manages schema migrations,
// WAL journaling, and exposes typed CRUD methods for config, API keys,
// history entries, and custom voice presets.
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

func openDatabase(dbPath string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	return db, nil
}

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

	if err := validateSchema(db); err != nil {
		return fmt.Errorf("validate schema: %w", err)
	}

	return nil
}

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

func validateSchema(db *sql.DB) error {
	required := map[string][]string{
		"api_keys":        {"id", "provider", "encrypted", "nonce"},
		"config":          {"key", "value"},
		"history":         {"id", "type", "voice_name", "input_text", "result_json", "audio_path", "created_at"},
		"voices":          {"name", "pitch", "gender", "characteristics", "audio_sample_url", "file_uri", "analysis_json", "image_url"},
		"custom_presets":  {"id", "name", "voice_name", "system_instruction", "sample_text", "audio_path", "source_query", "metadata_json", "color", "sort_order", "created_at", "updated_at"},
		"favorites":       {"voice_name", "created_at"},
		"preset_tags":     {"id", "preset_id", "tag", "color"},
		"preset_versions": {"id", "preset_id", "name", "voice_name", "system_instruction", "sample_text", "color", "metadata_json", "created_at"},
		"api_key_pool":    {"id", "provider", "label", "encrypted", "nonce", "is_active", "error_count", "last_used_at", "created_at", "updated_at"},
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
