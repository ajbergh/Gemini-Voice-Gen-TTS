// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package server assembles the HTTP server with all handlers, routes,
// middleware (logging, CORS, panic recovery), and the SPA fallback handler
// for the embedded frontend.
package server

import (
	"fmt"
	"io/fs"
	"net/http"
	"strings"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/handler"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// Server holds the HTTP server and its dependencies.
type Server struct {
	Mux  *http.ServeMux
	Addr string
}

// New creates a new Server with all routes and middleware configured.
func New(addr string, st *store.Store, cryptoKey []byte, frontendFS fs.FS, audioCacheDir string) *Server {
	mux := http.NewServeMux()

	// Initialize handlers
	configH := &handler.ConfigHandler{Store: st}
	keysH := &handler.KeysHandler{Store: st, CryptoKey: cryptoKey}
	historyH := &handler.HistoryHandler{Store: st}
	progressH := handler.NewProgressHub()
	voicesH := &handler.VoicesHandler{Store: st, KeysHandler: keysH, AudioCacheDir: audioCacheDir, ProgressHub: progressH}
	presetsH := &handler.PresetsHandler{Store: st, AudioCacheDir: audioCacheDir}
	favoritesH := &handler.FavoritesHandler{Store: st}
	cacheH := &handler.CacheHandler{AudioCacheDir: audioCacheDir}
	backupH := &handler.BackupHandler{Store: st}

	// Register API routes
	RegisterRoutes(mux, configH, keysH, historyH, voicesH, presetsH, favoritesH, cacheH, backupH, progressH)

	// Serve embedded frontend (SPA fallback)
	if frontendFS != nil {
		fileServer := http.FileServer(http.FS(frontendFS))
		mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
			// If the path starts with /api, it's already handled above (404 for unmatched API routes)
			if strings.HasPrefix(r.URL.Path, "/api/") {
				http.NotFound(w, r)
				return
			}

			// Try to serve the file; if not found, serve index.html (SPA routing)
			path := r.URL.Path
			if path == "/" {
				path = "/index.html"
			}

			// Check if file exists in the embedded FS
			f, err := frontendFS.Open(strings.TrimPrefix(path, "/"))
			if err != nil {
				// File not found — serve index.html for SPA routing
				r.URL.Path = "/index.html"
			} else {
				f.Close()
			}

			fileServer.ServeHTTP(w, r)
		})
	}

	return &Server{
		Mux:  mux,
		Addr: addr,
	}
}

// Handler returns the fully wrapped handler with middleware.
func (s *Server) Handler() http.Handler {
	var h http.Handler = s.Mux
	h = securityHeadersMiddleware(h)
	h = corsMiddleware(h)
	h = rateLimitMiddleware(DefaultRateLimiterConfig())(h)
	h = loggingMiddleware(h)
	h = recoveryMiddleware(h)
	return h
}

// ListenAndServe starts the HTTP server.
func (s *Server) ListenAndServe() error {
	return fmt.Errorf("server: %w", http.ListenAndServe(s.Addr, s.Handler()))
}
