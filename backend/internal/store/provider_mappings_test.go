// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package store

import (
	"path/filepath"
	"testing"
)

func TestProviderVoiceMappingUpsertAndLookup(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "provider-mappings.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	projectID, err := st.CreateProject(ScriptProject{
		Title:  "Provider Mapping Test",
		Kind:   "audiobook",
		Status: "active",
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	// Global mapping: Gemini Kore → Gemini Puck (voice alias at global scope)
	globalID, err := st.UpsertProviderVoiceMapping(ProviderVoiceMapping{
		SourceProvider: "gemini",
		SourceVoice:    "Kore",
		TargetProvider: "gemini",
		TargetVoice:    "Puck",
	})
	if err != nil {
		t.Fatalf("upsert global mapping: %v", err)
	}
	globalID2, err := st.UpsertProviderVoiceMapping(ProviderVoiceMapping{
		SourceProvider: "gemini",
		SourceVoice:    "Kore",
		TargetProvider: "gemini",
		TargetVoice:    "Charon",
		Notes:          "updated",
	})
	if err != nil {
		t.Fatalf("upsert duplicate global mapping: %v", err)
	}
	if globalID2 != globalID {
		t.Fatalf("expected duplicate global upsert to reuse id %d, got %d", globalID, globalID2)
	}

	mappings, err := st.ListProviderVoiceMappings(projectID)
	if err != nil {
		t.Fatalf("list mappings: %v", err)
	}
	if len(mappings) != 1 || mappings[0].TargetVoice != "Charon" {
		t.Fatalf("expected one updated global mapping, got %#v", mappings)
	}

	found, err := st.FindProviderVoiceMapping(projectID, "gemini", "Kore", "gemini")
	if err != nil {
		t.Fatalf("find global mapping: %v", err)
	}
	if found == nil || found.ProjectID != nil || found.TargetVoice != "Charon" {
		t.Fatalf("expected global mapping fallback, got %#v", found)
	}

	// Project-scoped override: same source → different target voice
	scopedProjectID := projectID
	scopedID, err := st.UpsertProviderVoiceMapping(ProviderVoiceMapping{
		ProjectID:      &scopedProjectID,
		SourceProvider: "gemini",
		SourceVoice:    "Kore",
		TargetProvider: "gemini",
		TargetVoice:    "Zephyr",
	})
	if err != nil {
		t.Fatalf("upsert project mapping: %v", err)
	}
	found, err = st.FindProviderVoiceMapping(projectID, "gemini", "Kore", "gemini")
	if err != nil {
		t.Fatalf("find scoped mapping: %v", err)
	}
	if found == nil || found.ProjectID == nil || *found.ProjectID != projectID || found.TargetVoice != "Zephyr" {
		t.Fatalf("expected project mapping to override global, got %#v", found)
	}

	if err := st.DeleteProviderVoiceMapping(scopedID); err != nil {
		t.Fatalf("delete scoped mapping: %v", err)
	}
	found, err = st.FindProviderVoiceMapping(projectID, "gemini", "Kore", "gemini")
	if err != nil {
		t.Fatalf("find global after scoped delete: %v", err)
	}
	if found == nil || found.ProjectID != nil || found.TargetVoice != "Charon" {
		t.Fatalf("expected global mapping after scoped delete, got %#v", found)
	}

	if err := st.DeleteProviderVoiceMapping(globalID); err != nil {
		t.Fatalf("delete global mapping: %v", err)
	}
	found, err = st.FindProviderVoiceMapping(projectID, "gemini", "Kore", "gemini")
	if err != nil {
		t.Fatalf("find after deletes: %v", err)
	}
	if found != nil {
		t.Fatalf("expected no mapping after deletes, got %#v", found)
	}
}
