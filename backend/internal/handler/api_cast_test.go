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

func TestCastHandlerCRUDAndVersions(t *testing.T) {
	st, err := store.New(filepath.Join(t.TempDir(), "cast-handler.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	projectID, err := st.CreateProject(store.ScriptProject{Title: "Cast API Project"})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	h := &CastHandler{Store: st}

	createRR := httptest.NewRecorder()
	createReq := castRequest(http.MethodPost, projectID, 0, 0, `{"name":"Hero","role":"protagonist","description":"Lead voice","voice_name":"Zephyr"}`)
	h.CreateProjectCast(createRR, createReq)
	if createRR.Code != http.StatusCreated {
		t.Fatalf("create status = %d: %s", createRR.Code, createRR.Body.String())
	}
	var created store.CastProfile
	if err := json.Unmarshal(createRR.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created profile: %v", err)
	}
	if created.ID == 0 || created.ProjectID != projectID || created.Name != "Hero" {
		t.Fatalf("unexpected created profile: %#v", created)
	}

	listRR := httptest.NewRecorder()
	h.ListProjectCast(listRR, castRequest(http.MethodGet, projectID, 0, 0, ""))
	if listRR.Code != http.StatusOK {
		t.Fatalf("list status = %d: %s", listRR.Code, listRR.Body.String())
	}
	var profiles []store.CastProfile
	if err := json.Unmarshal(listRR.Body.Bytes(), &profiles); err != nil {
		t.Fatalf("decode profiles: %v", err)
	}
	if len(profiles) != 1 {
		t.Fatalf("expected one profile, got %d", len(profiles))
	}

	updateRR := httptest.NewRecorder()
	updateReq := castRequest(http.MethodPut, 0, created.ID, 0, `{"name":"Hero Prime","role":"protagonist","description":"Updated","voice_name":"Charon"}`)
	h.UpdateCastProfile(updateRR, updateReq)
	if updateRR.Code != http.StatusOK {
		t.Fatalf("update status = %d: %s", updateRR.Code, updateRR.Body.String())
	}

	versionsRR := httptest.NewRecorder()
	h.ListCastProfileVersions(versionsRR, castRequest(http.MethodGet, 0, created.ID, 0, ""))
	if versionsRR.Code != http.StatusOK {
		t.Fatalf("versions status = %d: %s", versionsRR.Code, versionsRR.Body.String())
	}
	var versions []store.CastProfileVersion
	if err := json.Unmarshal(versionsRR.Body.Bytes(), &versions); err != nil {
		t.Fatalf("decode versions: %v", err)
	}
	if len(versions) != 1 || versions[0].Name != "Hero" {
		t.Fatalf("expected prior profile version, got %#v", versions)
	}

	revertRR := httptest.NewRecorder()
	h.RevertCastProfileVersion(revertRR, castRequest(http.MethodPost, 0, created.ID, versions[0].ID, ""))
	if revertRR.Code != http.StatusOK {
		t.Fatalf("revert status = %d: %s", revertRR.Code, revertRR.Body.String())
	}
	var reverted store.CastProfile
	if err := json.Unmarshal(revertRR.Body.Bytes(), &reverted); err != nil {
		t.Fatalf("decode reverted profile: %v", err)
	}
	if reverted.Name != "Hero" {
		t.Fatalf("expected reverted name Hero, got %q", reverted.Name)
	}

	deleteRR := httptest.NewRecorder()
	h.DeleteCastProfile(deleteRR, castRequest(http.MethodDelete, 0, created.ID, 0, ""))
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("delete status = %d: %s", deleteRR.Code, deleteRR.Body.String())
	}
}

func castRequest(method string, projectID, profileID, versionID int64, body string) *http.Request {
	if body == "" {
		body = "{}"
	}
	req := httptest.NewRequest(method, "/", strings.NewReader(body))
	if projectID > 0 {
		req.SetPathValue("id", int64PathValue(projectID))
	}
	if profileID > 0 {
		req.SetPathValue("profileId", int64PathValue(profileID))
	}
	if versionID > 0 {
		req.SetPathValue("versionId", int64PathValue(versionID))
	}
	return req
}
