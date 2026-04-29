// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

func TestProvidersHandlerListProviders(t *testing.T) {
	st, err := store.New(filepath.Join(t.TempDir(), "providers-handler.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	keysH := &KeysHandler{Store: st}
	h := &ProvidersHandler{Store: st, KeysHandler: keysH}

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/providers", nil)
	h.ListProviders(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("list providers status = %d: %s", rr.Code, rr.Body.String())
	}

	var providers []struct {
		ID            string `json:"id"`
		DisplayName   string `json:"display_name"`
		KeyConfigured bool   `json:"key_configured"`
	}
	if err := json.Unmarshal(rr.Body.Bytes(), &providers); err != nil {
		t.Fatalf("decode providers: %v", err)
	}

	if len(providers) != 1 {
		t.Fatalf("expected exactly 1 provider, got %d", len(providers))
	}

	// No keys configured — should report key_configured: false.
	for _, p := range providers {
		if p.KeyConfigured {
			t.Errorf("provider %q should not report key_configured=true with empty key store", p.ID)
		}
	}

	// Registry must contain exactly the gemini provider.
	if providers[0].ID != "gemini" {
		t.Errorf("expected provider id %q, got %q", "gemini", providers[0].ID)
	}
}
