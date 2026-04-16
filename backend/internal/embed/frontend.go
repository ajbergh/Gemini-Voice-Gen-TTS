// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package embed bundles the Vite production build output into the binary.
//
// The dist/ directory is embedded at compile time via go:embed. In production
// the Go server serves these files directly; during development the dist/
// directory may be empty (the Vite dev server handles frontend requests).
package embed

import (
	"embed"
	"io/fs"
)

// Frontend embeds the Vite production build output.
// During development (when the dist/ directory doesn't exist), this will be empty.
// Build the frontend first: cd frontend && npm run build
//
//go:embed all:dist
var frontendFiles embed.FS

// FrontendFS returns the embedded frontend filesystem rooted at dist/.
// Returns nil if the dist directory is empty or doesn't exist.
func FrontendFS() fs.FS {
	sub, err := fs.Sub(frontendFiles, "dist")
	if err != nil {
		return nil
	}
	return sub
}
