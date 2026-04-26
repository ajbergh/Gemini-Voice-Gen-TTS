// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package store_test

import (
	"testing"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

func TestClientCRUD(t *testing.T) {
	s, err := store.New(t.TempDir() + "/test.db")
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()

	t.Run("create client", func(t *testing.T) {
		c := &store.Client{
			Name:        "Acme Corp",
			Description: "Flagship brand",
			BrandNotes:  "Always upbeat",
		}
		if err := s.CreateClient(c); err != nil {
			t.Fatal(err)
		}
		if c.ID == 0 {
			t.Fatal("expected non-zero ID")
		}
	})

	t.Run("list clients", func(t *testing.T) {
		list, err := s.ListClients()
		if err != nil {
			t.Fatal(err)
		}
		if len(list) != 1 {
			t.Fatalf("expected 1 client, got %d", len(list))
		}
		if list[0].Name != "Acme Corp" {
			t.Fatalf("unexpected name %q", list[0].Name)
		}
	})

	t.Run("get client", func(t *testing.T) {
		list, _ := s.ListClients()
		id := list[0].ID
		c, err := s.GetClient(id)
		if err != nil {
			t.Fatal(err)
		}
		if c.Description != "Flagship brand" {
			t.Fatalf("unexpected description %q", c.Description)
		}
	})

	t.Run("update client", func(t *testing.T) {
		list, _ := s.ListClients()
		c := list[0]
		c.BrandNotes = "Updated notes"
		if err := s.UpdateClient(c); err != nil {
			t.Fatal(err)
		}
		c2, _ := s.GetClient(c.ID)
		if c2.BrandNotes != "Updated notes" {
			t.Fatalf("update did not persist: %q", c2.BrandNotes)
		}
	})

	t.Run("add asset", func(t *testing.T) {
		list, _ := s.ListClients()
		cid := list[0].ID
		a := &store.ClientAsset{
			ClientID:  cid,
			AssetType: "style",
			AssetID:   99,
			Label:     "Brand style",
		}
		if err := s.AddClientAsset(a); err != nil {
			t.Fatal(err)
		}
		if a.ID == 0 {
			t.Fatal("expected non-zero asset ID")
		}
	})

	t.Run("list assets", func(t *testing.T) {
		list, _ := s.ListClients()
		cid := list[0].ID
		assets, err := s.ListClientAssets(cid)
		if err != nil {
			t.Fatal(err)
		}
		if len(assets) != 1 {
			t.Fatalf("expected 1 asset, got %d", len(assets))
		}
		if assets[0].AssetType != "style" {
			t.Fatalf("unexpected asset type %q", assets[0].AssetType)
		}
	})

	t.Run("add duplicate asset ignored", func(t *testing.T) {
		list, _ := s.ListClients()
		cid := list[0].ID
		a := &store.ClientAsset{ClientID: cid, AssetType: "style", AssetID: 99, Label: "dup"}
		// Should not error — INSERT OR IGNORE
		if err := s.AddClientAsset(a); err != nil {
			t.Fatal(err)
		}
		assets, _ := s.ListClientAssets(cid)
		if len(assets) != 1 {
			t.Fatalf("expected 1 asset after dup, got %d", len(assets))
		}
	})

	t.Run("remove asset", func(t *testing.T) {
		list, _ := s.ListClients()
		cid := list[0].ID
		assets, _ := s.ListClientAssets(cid)
		if err := s.RemoveClientAsset(cid, assets[0].ID); err != nil {
			t.Fatal(err)
		}
		assets2, _ := s.ListClientAssets(cid)
		if len(assets2) != 0 {
			t.Fatalf("expected 0 assets after remove, got %d", len(assets2))
		}
	})

	t.Run("delete client", func(t *testing.T) {
		list, _ := s.ListClients()
		if err := s.DeleteClient(list[0].ID); err != nil {
			t.Fatal(err)
		}
		list2, _ := s.ListClients()
		if len(list2) != 0 {
			t.Fatalf("expected 0 clients after delete, got %d", len(list2))
		}
	})
}
