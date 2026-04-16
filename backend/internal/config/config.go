// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package config manages application runtime configuration.
//
// It provides platform-aware default paths (Windows: %APPDATA%, macOS:
// ~/Library/Application Support, Linux: ~/.local/share), JSON config file
// loading with fallback defaults, and data directory creation.
package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// Config holds the application runtime configuration.
type Config struct {
	Port          int    `json:"port"`
	DBPath        string `json:"db_path"`
	Passphrase    string `json:"-"` // never serialized
	LogLevel      string `json:"log_level"`
	OpenBrowser   bool   `json:"open_browser"`
	DataDir       string `json:"data_dir"`
	AudioCacheDir string `json:"audio_cache_dir"`
}

// DefaultConfig returns configuration with sensible defaults.
func DefaultConfig() Config {
	dataDir := defaultDataDir()
	return Config{
		Port:          8080,
		DBPath:        filepath.Join(dataDir, "data.db"),
		LogLevel:      "info",
		OpenBrowser:   true,
		DataDir:       dataDir,
		AudioCacheDir: filepath.Join(dataDir, "audio_cache"),
	}
}

// Load reads config from a JSON file, falling back to defaults for missing fields.
func Load(path string) (Config, error) {
	cfg := DefaultConfig()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return cfg, fmt.Errorf("read config: %w", err)
	}

	if err := json.Unmarshal(data, &cfg); err != nil {
		return cfg, fmt.Errorf("parse config: %w", err)
	}

	return cfg, nil
}

// EnsureDataDir creates the data directory and subdirectories if they don't exist.
func (c *Config) EnsureDataDir() error {
	if err := os.MkdirAll(c.DataDir, 0o700); err != nil {
		return err
	}
	return os.MkdirAll(c.AudioCacheDir, 0o700)
}

// defaultDataDir returns the platform-appropriate data directory.
func defaultDataDir() string {
	switch runtime.GOOS {
	case "windows":
		if appData := os.Getenv("APPDATA"); appData != "" {
			return filepath.Join(appData, "gemini-voice-library")
		}
		home, _ := os.UserHomeDir()
		return filepath.Join(home, "AppData", "Roaming", "gemini-voice-library")
	case "darwin":
		home, _ := os.UserHomeDir()
		return filepath.Join(home, "Library", "Application Support", "gemini-voice-library")
	default: // linux and others
		if xdg := os.Getenv("XDG_DATA_HOME"); xdg != "" {
			return filepath.Join(xdg, "gemini-voice-library")
		}
		home, _ := os.UserHomeDir()
		return filepath.Join(home, ".local", "share", "gemini-voice-library")
	}
}
