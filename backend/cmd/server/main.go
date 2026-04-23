// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package main is the entry point for the Gemini Voice Studio server.
//
// It parses CLI flags (--port, --db, --passphrase, --log-level, --open),
// loads configuration with platform-aware defaults, derives the AES-256
// encryption key, opens the SQLite database, embeds the frontend SPA,
// and starts the HTTP server with graceful shutdown on SIGINT/SIGTERM.
package main

import (
	"context"
	"flag"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/config"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/crypto"
	fe "github.com/ajbergh/gemini-voice-gen-tts/backend/internal/embed"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/server"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

func main() {
	// Parse flags
	port := flag.Int("port", 0, "HTTP server port (default: 8080)")
	dbPath := flag.String("db", "", "SQLite database path")
	passphrase := flag.String("passphrase", "", "Encryption passphrase (uses machine ID if empty)")
	logLevel := flag.String("log-level", "", "Log level: debug, info, warn, error")
	openBrowser := flag.Bool("open", true, "Open browser on startup")
	flag.Parse()

	// Load config file
	cfg := config.DefaultConfig()

	// Override from flags
	if *port != 0 {
		cfg.Port = *port
	}
	if *dbPath != "" {
		cfg.DBPath = *dbPath
	}
	if *passphrase != "" {
		cfg.Passphrase = *passphrase
	}
	if *logLevel != "" {
		cfg.LogLevel = *logLevel
	}
	cfg.OpenBrowser = *openBrowser

	// Set up structured logging
	var level slog.Level
	switch cfg.LogLevel {
	case "debug":
		level = slog.LevelDebug
	case "warn":
		level = slog.LevelWarn
	case "error":
		level = slog.LevelError
	default:
		level = slog.LevelInfo
	}
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: level})))

	// Ensure data directory exists
	if err := cfg.EnsureDataDir(); err != nil {
		slog.Error("failed to create data directory", "error", err)
		os.Exit(1)
	}

	// Derive encryption key
	cryptoKey, err := crypto.DeriveKey(cfg.Passphrase)
	if err != nil {
		slog.Error("failed to derive encryption key", "error", err)
		os.Exit(1)
	}

	// Open database
	st, err := store.New(cfg.DBPath)
	if err != nil {
		slog.Error("failed to open database", "error", err)
		os.Exit(1)
	}
	defer st.Close()

	// Get embedded frontend
	frontendFS := fe.FrontendFS()

	// Create server
	addr := fmt.Sprintf("127.0.0.1:%d", cfg.Port)
	srv := server.New(addr, st, cryptoKey, frontendFS, cfg.AudioCacheDir)

	// Create HTTP server for graceful shutdown
	httpServer := &http.Server{
		Addr:         addr,
		Handler:      srv.Handler(),
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 120 * time.Second, // TTS can take a while
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	go func() {
		<-ctx.Done()
		slog.Info("shutting down server...")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		httpServer.Shutdown(shutdownCtx)
	}()

	// Open browser
	url := fmt.Sprintf("http://localhost:%d", cfg.Port)
	if cfg.OpenBrowser {
		go func() {
			time.Sleep(500 * time.Millisecond)
			openURL(url)
		}()
	}

	slog.Info("starting server", "addr", url, "db", cfg.DBPath)
	if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		slog.Error("server error", "error", err)
		os.Exit(1)
	}
	slog.Info("server stopped")
}

// openURL opens a URL in the default browser.
func openURL(url string) {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("cmd", "/c", "start", url)
	case "darwin":
		cmd = exec.Command("open", url)
	default:
		cmd = exec.Command("xdg-open", url)
	}
	if err := cmd.Start(); err != nil {
		slog.Warn("failed to open browser", "error", err)
	}
}
