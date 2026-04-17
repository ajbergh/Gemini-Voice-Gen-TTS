// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package server

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestOriginProtectionMiddleware(t *testing.T) {
	handler := originProtectionMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusNoContent)
	}))

	t.Run("allows trusted localhost origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/api/keys", nil)
		req.Header.Set("Origin", "http://localhost:5173")
		res := httptest.NewRecorder()

		handler.ServeHTTP(res, req)

		if res.Code != http.StatusNoContent {
			t.Fatalf("expected trusted origin to pass, got %d", res.Code)
		}
	})

	t.Run("rejects cross-site origin", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodDelete, "http://127.0.0.1/api/history", nil)
		req.Header.Set("Origin", "https://evil.example")
		res := httptest.NewRecorder()

		handler.ServeHTTP(res, req)

		if res.Code != http.StatusForbidden {
			t.Fatalf("expected forbidden response, got %d", res.Code)
		}
	})

	t.Run("allows requests without browser origin headers", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "http://127.0.0.1/api/backup", nil)
		res := httptest.NewRecorder()

		handler.ServeHTTP(res, req)

		if res.Code != http.StatusNoContent {
			t.Fatalf("expected non-browser request to pass, got %d", res.Code)
		}
	})
}
