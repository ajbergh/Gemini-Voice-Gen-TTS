// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package store

import (
	"path/filepath"
	"testing"
)

func TestGetSetConfigValue(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "config.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	// GetConfigValue returns defaultVal for a missing key.
	got := st.GetConfigValue(ConfigKeyDefaultModel, "fallback-model")
	if got != "fallback-model" {
		t.Fatalf("expected default 'fallback-model', got %q", got)
	}

	// SetConfig then GetConfigValue returns the set value.
	if err := st.SetConfig(ConfigKeyDefaultModel, "gemini-2.5-pro-preview-tts"); err != nil {
		t.Fatalf("SetConfig: %v", err)
	}
	got = st.GetConfigValue(ConfigKeyDefaultModel, "fallback-model")
	if got != "gemini-2.5-pro-preview-tts" {
		t.Fatalf("expected stored value, got %q", got)
	}

	// GetConfigValue returns defaultVal when the stored value is empty string.
	if err := st.SetConfig(ConfigKeyDefaultLanguageCode, ""); err != nil {
		t.Fatalf("SetConfig empty: %v", err)
	}
	got = st.GetConfigValue(ConfigKeyDefaultLanguageCode, "en-US")
	if got != "en-US" {
		t.Fatalf("expected default for empty value, got %q", got)
	}

	// GetConfig (raw) still works for a set key.
	raw, err := st.GetConfig(ConfigKeyDefaultModel)
	if err != nil {
		t.Fatalf("GetConfig: %v", err)
	}
	if raw != "gemini-2.5-pro-preview-tts" {
		t.Fatalf("GetConfig: expected stored value, got %q", raw)
	}

	// SetConfigBatch upserts multiple keys atomically.
	if err := st.SetConfigBatch(map[string]string{
		ConfigKeyDefaultBatchConcurrency: "4",
		ConfigKeyDefaultRetryCount:       "3",
	}); err != nil {
		t.Fatalf("SetConfigBatch: %v", err)
	}
	if v := st.GetConfigValue(ConfigKeyDefaultBatchConcurrency, "1"); v != "4" {
		t.Fatalf("batch concurrency: expected '4', got %q", v)
	}
	if v := st.GetConfigValue(ConfigKeyDefaultRetryCount, "0"); v != "3" {
		t.Fatalf("retry count: expected '3', got %q", v)
	}
}
