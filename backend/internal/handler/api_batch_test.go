// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"path/filepath"
	"testing"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

func TestBatchResolveModelSegmentOverridesProjectDefault(t *testing.T) {
	st, err := store.New(filepath.Join(t.TempDir(), "batch-resolve.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	h := &BatchHandler{Store: st}
	geminiProvider := "gemini"
	projectModel := "gemini-2.5-flash-preview-tts"
	segmentModel := "gemini-2.5-pro-preview-tts"
	project := &store.ScriptProject{
		DefaultProvider: &geminiProvider,
		DefaultModel:    &projectModel,
	}
	seg := store.ScriptSegment{}

	provider := h.resolveProvider(project, seg)
	if provider != "gemini" {
		t.Fatalf("provider = %q, want gemini", provider)
	}
	// No segment model override — project default model should be inherited.
	if model := h.resolveModel(provider, project, seg); model != projectModel {
		t.Fatalf("model = %q, want project default %q", model, projectModel)
	}

	// Explicit segment model override takes priority over project default.
	seg.Model = &segmentModel
	if model := h.resolveModel(provider, project, seg); model != segmentModel {
		t.Fatalf("explicit segment model = %q, want %q", model, segmentModel)
	}
}

func TestBatchResolveModelUsesClientDefaultForInheritedProvider(t *testing.T) {
	st, err := store.New(filepath.Join(t.TempDir(), "batch-client-resolve.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	geminiProvider := "gemini"
	geminiModel := "gemini-2.5-pro-preview-tts"
	client := &store.Client{
		Name:            "Client",
		DefaultProvider: &geminiProvider,
		DefaultModel:    &geminiModel,
	}
	if err := st.CreateClient(client); err != nil {
		t.Fatalf("create client: %v", err)
	}

	h := &BatchHandler{Store: st}
	project := &store.ScriptProject{ClientID: &client.ID}
	seg := store.ScriptSegment{}

	provider := h.resolveProvider(project, seg)
	if provider != "gemini" {
		t.Fatalf("provider = %q, want gemini", provider)
	}
	if model := h.resolveModel(provider, project, seg); model != geminiModel {
		t.Fatalf("model = %q, want %q", model, geminiModel)
	}
}
