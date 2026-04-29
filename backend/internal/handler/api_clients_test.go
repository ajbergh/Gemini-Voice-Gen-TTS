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

func TestClientHandlerCRUD(t *testing.T) {
	st, err := store.New(filepath.Join(t.TempDir(), "clients-handler.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	h := &ClientHandler{Store: st}

	clientReq := func(method, path string, clientID, assetID int64, body string) *http.Request {
		req := httptest.NewRequest(method, path, strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		if clientID > 0 {
			req.SetPathValue("id", int64PathValue(clientID))
		}
		if assetID > 0 {
			req.SetPathValue("assetId", int64PathValue(assetID))
		}
		return req
	}

	// -------------------------------------------------------------------------
	// 1. Create client.
	// -------------------------------------------------------------------------
	body, _ := json.Marshal(map[string]any{
		"name":        "TechBrand",
		"description": "A tech company",
		"brand_notes": "Always use a confident tone",
	})
	rr := httptest.NewRecorder()
	h.CreateClient(rr, clientReq(http.MethodPost, "/api/clients", 0, 0, string(body)))
	if rr.Code != http.StatusCreated {
		t.Fatalf("create status = %d: %s", rr.Code, rr.Body.String())
	}
	var created store.Client
	if err := json.Unmarshal(rr.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created: %v", err)
	}
	if created.ID == 0 || created.Name != "TechBrand" {
		t.Fatalf("unexpected created client: %#v", created)
	}
	clientID := created.ID

	// -------------------------------------------------------------------------
	// 2. List clients.
	// -------------------------------------------------------------------------
	rr = httptest.NewRecorder()
	h.ListClients(rr, clientReq(http.MethodGet, "/api/clients", 0, 0, ""))
	if rr.Code != http.StatusOK {
		t.Fatalf("list status = %d", rr.Code)
	}
	var list []*store.Client
	if err := json.Unmarshal(rr.Body.Bytes(), &list); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if len(list) != 1 {
		t.Fatalf("expected 1 client, got %d", len(list))
	}

	// -------------------------------------------------------------------------
	// 3. Get client.
	// -------------------------------------------------------------------------
	rr = httptest.NewRecorder()
	h.GetClient(rr, clientReq(http.MethodGet, "/api/clients/1", clientID, 0, ""))
	if rr.Code != http.StatusOK {
		t.Fatalf("get status = %d: %s", rr.Code, rr.Body.String())
	}

	// -------------------------------------------------------------------------
	// 4. Update client.
	// -------------------------------------------------------------------------
	updBody, _ := json.Marshal(map[string]any{
		"name":        "TechBrand",
		"description": "Updated",
		"brand_notes": "Bold and clear",
	})
	rr = httptest.NewRecorder()
	h.UpdateClient(rr, clientReq(http.MethodPut, "/api/clients/1", clientID, 0, string(updBody)))
	if rr.Code != http.StatusOK {
		t.Fatalf("update status = %d: %s", rr.Code, rr.Body.String())
	}
	var updated store.Client
	if err := json.Unmarshal(rr.Body.Bytes(), &updated); err != nil {
		t.Fatalf("decode updated: %v", err)
	}
	if updated.Description != "Updated" {
		t.Fatalf("update did not persist: %q", updated.Description)
	}

	// -------------------------------------------------------------------------
	// 5. Add asset.
	// -------------------------------------------------------------------------
	assetBody, _ := json.Marshal(map[string]any{
		"asset_type": "style",
		"asset_id":   42,
		"label":      "Preferred style",
	})
	rr = httptest.NewRecorder()
	h.AddClientAsset(rr, clientReq(http.MethodPost, "/api/clients/1/assets", clientID, 0, string(assetBody)))
	if rr.Code != http.StatusCreated {
		t.Fatalf("add asset status = %d: %s", rr.Code, rr.Body.String())
	}
	var addedAsset store.ClientAsset
	if err := json.Unmarshal(rr.Body.Bytes(), &addedAsset); err != nil {
		t.Fatalf("decode asset: %v", err)
	}
	if addedAsset.ID == 0 || addedAsset.AssetType != "style" {
		t.Fatalf("unexpected asset: %#v", addedAsset)
	}
	assetID := addedAsset.ID

	// -------------------------------------------------------------------------
	// 6. List assets.
	// -------------------------------------------------------------------------
	rr = httptest.NewRecorder()
	h.ListClientAssets(rr, clientReq(http.MethodGet, "/api/clients/1/assets", clientID, 0, ""))
	if rr.Code != http.StatusOK {
		t.Fatalf("list assets status = %d", rr.Code)
	}
	var assetList []*store.ClientAsset
	if err := json.Unmarshal(rr.Body.Bytes(), &assetList); err != nil {
		t.Fatalf("decode asset list: %v", err)
	}
	if len(assetList) != 1 {
		t.Fatalf("expected 1 asset, got %d", len(assetList))
	}

	// -------------------------------------------------------------------------
	// 7. Remove asset + verify 0.
	// -------------------------------------------------------------------------
	rr = httptest.NewRecorder()
	h.RemoveClientAsset(rr, clientReq(http.MethodDelete, "/api/clients/1/assets/1", clientID, assetID, ""))
	if rr.Code != http.StatusNoContent {
		t.Fatalf("remove asset status = %d: %s", rr.Code, rr.Body.String())
	}
	rr = httptest.NewRecorder()
	h.ListClientAssets(rr, clientReq(http.MethodGet, "/api/clients/1/assets", clientID, 0, ""))
	var assetList2 []*store.ClientAsset
	_ = json.Unmarshal(rr.Body.Bytes(), &assetList2)
	if len(assetList2) != 0 {
		t.Fatalf("expected 0 assets after remove, got %d", len(assetList2))
	}

	// -------------------------------------------------------------------------
	// 8. Delete client.
	// -------------------------------------------------------------------------
	rr = httptest.NewRecorder()
	h.DeleteClient(rr, clientReq(http.MethodDelete, "/api/clients/1", clientID, 0, ""))
	if rr.Code != http.StatusNoContent {
		t.Fatalf("delete status = %d: %s", rr.Code, rr.Body.String())
	}
	rr = httptest.NewRecorder()
	h.ListClients(rr, clientReq(http.MethodGet, "/api/clients", 0, 0, ""))
	var finalList []*store.Client
	_ = json.Unmarshal(rr.Body.Bytes(), &finalList)
	if len(finalList) != 0 {
		t.Fatalf("expected 0 clients after delete, got %d", len(finalList))
	}
}
