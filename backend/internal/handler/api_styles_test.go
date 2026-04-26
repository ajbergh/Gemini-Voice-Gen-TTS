// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

func TestStylesHandlerCRUDAndVersions(t *testing.T) {
	st, err := store.New(filepath.Join(t.TempDir(), "styles-handler.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	h := &StylesHandler{Store: st}

	// -------------------------------------------------------------------------
	// 1. List global styles — 8 built-in styles.
	// -------------------------------------------------------------------------
	listRR := httptest.NewRecorder()
	h.ListStyles(listRR, httptest.NewRequest(http.MethodGet, "/api/styles", nil))
	if listRR.Code != http.StatusOK {
		t.Fatalf("list status = %d: %s", listRR.Code, listRR.Body.String())
	}
	var styles []store.PerformanceStyle
	if err := json.Unmarshal(listRR.Body.Bytes(), &styles); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(styles) != 8 {
		t.Fatalf("expected 8 built-in styles, got %d", len(styles))
	}

	// -------------------------------------------------------------------------
	// 2. Create a new user style.
	// -------------------------------------------------------------------------
	createRR := httptest.NewRecorder()
	createBody := `{"name":"Test Style","description":"A test.","category":"custom","director_notes":"Speak clearly."}`
	h.CreateStyle(createRR, httptest.NewRequest(http.MethodPost, "/api/styles",
		strings.NewReader(createBody)))
	if createRR.Code != http.StatusCreated {
		t.Fatalf("create status = %d: %s", createRR.Code, createRR.Body.String())
	}
	var created store.PerformanceStyle
	if err := json.Unmarshal(createRR.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created: %v", err)
	}
	if created.ID == 0 || created.Name != "Test Style" {
		t.Fatalf("unexpected created style: %#v", created)
	}
	if created.IsBuiltin {
		t.Error("user style should not be is_builtin")
	}

	// -------------------------------------------------------------------------
	// 3. GetStyle.
	// -------------------------------------------------------------------------
	getRR := httptest.NewRecorder()
	getReq := httptest.NewRequest(http.MethodGet, "/api/styles/"+int64PathValue(created.ID), nil)
	getReq.SetPathValue("id", int64PathValue(created.ID))
	h.GetStyle(getRR, getReq)
	if getRR.Code != http.StatusOK {
		t.Fatalf("get status = %d: %s", getRR.Code, getRR.Body.String())
	}

	// -------------------------------------------------------------------------
	// 4. UpdateStyle creates a version snapshot.
	// -------------------------------------------------------------------------
	updateRR := httptest.NewRecorder()
	updateBody := `{"name":"Updated Style","description":"Updated.","category":"custom","director_notes":"Speak more slowly."}`
	updateReq := httptest.NewRequest(http.MethodPut, "/", strings.NewReader(updateBody))
	updateReq.SetPathValue("id", int64PathValue(created.ID))
	h.UpdateStyle(updateRR, updateReq)
	if updateRR.Code != http.StatusOK {
		t.Fatalf("update status = %d: %s", updateRR.Code, updateRR.Body.String())
	}

	versionsRR := httptest.NewRecorder()
	versionsReq := httptest.NewRequest(http.MethodGet, "/", nil)
	versionsReq.SetPathValue("id", int64PathValue(created.ID))
	h.ListStyleVersions(versionsRR, versionsReq)
	if versionsRR.Code != http.StatusOK {
		t.Fatalf("versions status = %d: %s", versionsRR.Code, versionsRR.Body.String())
	}
	var versions []store.PerformanceStyleVersion
	if err := json.Unmarshal(versionsRR.Body.Bytes(), &versions); err != nil {
		t.Fatalf("decode versions: %v", err)
	}
	if len(versions) != 1 || versions[0].Name != "Test Style" {
		t.Fatalf("expected one prior version, got %#v", versions)
	}

	// -------------------------------------------------------------------------
	// 5. RevertStyleVersion.
	// -------------------------------------------------------------------------
	revertRR := httptest.NewRecorder()
	revertReq := httptest.NewRequest(http.MethodPost, "/", nil)
	revertReq.SetPathValue("id", int64PathValue(created.ID))
	revertReq.SetPathValue("versionId", int64PathValue(versions[0].ID))
	h.RevertStyleVersion(revertRR, revertReq)
	if revertRR.Code != http.StatusOK {
		t.Fatalf("revert status = %d: %s", revertRR.Code, revertRR.Body.String())
	}
	var reverted store.PerformanceStyle
	if err := json.Unmarshal(revertRR.Body.Bytes(), &reverted); err != nil {
		t.Fatalf("decode reverted: %v", err)
	}
	if reverted.Name != "Test Style" {
		t.Fatalf("expected reverted name Test Style, got %q", reverted.Name)
	}

	// -------------------------------------------------------------------------
	// 6. Delete user style.
	// -------------------------------------------------------------------------
	deleteRR := httptest.NewRecorder()
	deleteReq := httptest.NewRequest(http.MethodDelete, "/", nil)
	deleteReq.SetPathValue("id", int64PathValue(created.ID))
	h.DeleteStyle(deleteRR, deleteReq)
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("delete status = %d: %s", deleteRR.Code, deleteRR.Body.String())
	}

	// -------------------------------------------------------------------------
	// 7. Delete builtin style returns 400.
	// -------------------------------------------------------------------------
	deleteBuiltinRR := httptest.NewRecorder()
	deleteBuiltinReq := httptest.NewRequest(http.MethodDelete, "/", nil)
	deleteBuiltinReq.SetPathValue("id", "1")
	h.DeleteStyle(deleteBuiltinRR, deleteBuiltinReq)
	if deleteBuiltinRR.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 deleting builtin, got %d", deleteBuiltinRR.Code)
	}
}
