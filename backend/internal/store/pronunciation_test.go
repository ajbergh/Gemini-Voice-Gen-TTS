// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package store

import (
	"database/sql"
	"errors"
	"path/filepath"
	"testing"
)

func TestPronunciationCRUD(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "pronunciation.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	// Create a project for ownership checks.
	projectID, err := st.CreateProject(ScriptProject{Title: "Narration"})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	// --- Create dictionary ---
	dictID, err := st.CreateDictionary(projectID, "Main")
	if err != nil {
		t.Fatalf("create dictionary: %v", err)
	}

	dicts, err := st.ListDictionaries(projectID)
	if err != nil {
		t.Fatalf("list dictionaries: %v", err)
	}
	if len(dicts) != 1 {
		t.Fatalf("expected 1 dictionary, got %d", len(dicts))
	}
	if dicts[0].Name != "Main" {
		t.Errorf("expected name=Main, got %s", dicts[0].Name)
	}

	// --- Get dictionary ---
	dict, err := st.GetDictionary(projectID, dictID)
	if err != nil {
		t.Fatalf("get dictionary: %v", err)
	}
	if dict.ProjectID != projectID {
		t.Errorf("expected project_id=%d, got %d", projectID, dict.ProjectID)
	}

	// --- Rename dictionary ---
	if err := st.UpdateDictionary(projectID, dictID, "Glossary"); err != nil {
		t.Fatalf("update dictionary: %v", err)
	}
	dict, _ = st.GetDictionary(projectID, dictID)
	if dict.Name != "Glossary" {
		t.Errorf("expected name=Glossary, got %s", dict.Name)
	}

	// --- Wrong project ID should get ErrNoRows ---
	_, err = st.GetDictionary(projectID+999, dictID)
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected ErrNoRows for wrong project, got %v", err)
	}

	// --- Create entries ---
	entry1ID, err := st.CreateEntry(PronunciationEntry{
		DictionaryID: dictID,
		RawWord:      "GIF",
		Replacement:  "JIF",
		IsRegex:      false,
		Enabled:      true,
		SortOrder:    0,
	})
	if err != nil {
		t.Fatalf("create entry 1: %v", err)
	}

	_, err = st.CreateEntry(PronunciationEntry{
		DictionaryID: dictID,
		RawWord:      `\bDr\b`,
		Replacement:  "Doctor",
		IsRegex:      true,
		Enabled:      true,
		SortOrder:    1,
	})
	if err != nil {
		t.Fatalf("create entry 2: %v", err)
	}

	// Disabled entry
	_, err = st.CreateEntry(PronunciationEntry{
		DictionaryID: dictID,
		RawWord:      "unused",
		Replacement:  "x",
		Enabled:      false,
	})
	if err != nil {
		t.Fatalf("create disabled entry: %v", err)
	}

	// --- List entries ---
	entries, err := st.ListEntries(dictID)
	if err != nil {
		t.Fatalf("list entries: %v", err)
	}
	if len(entries) != 3 {
		t.Fatalf("expected 3 entries, got %d", len(entries))
	}

	// --- GetEntry ---
	e, err := st.GetEntry(dictID, entry1ID)
	if err != nil {
		t.Fatalf("get entry: %v", err)
	}
	if e.RawWord != "GIF" || e.Replacement != "JIF" {
		t.Errorf("unexpected entry: %+v", e)
	}
	if e.IsRegex {
		t.Error("expected is_regex=false")
	}

	// --- UpdateEntry ---
	e.Replacement = "JIFF"
	if err := st.UpdateEntry(*e); err != nil {
		t.Fatalf("update entry: %v", err)
	}
	updated, _ := st.GetEntry(dictID, entry1ID)
	if updated.Replacement != "JIFF" {
		t.Errorf("expected replacement=JIFF, got %s", updated.Replacement)
	}

	// --- ListEnabledEntriesForProject — should exclude disabled ---
	enabled, err := st.ListEnabledEntriesForProject(projectID)
	if err != nil {
		t.Fatalf("list enabled entries: %v", err)
	}
	if len(enabled) != 2 {
		t.Errorf("expected 2 enabled entries, got %d", len(enabled))
	}

	// --- DeleteEntry ---
	if err := st.DeleteEntry(dictID, entry1ID); err != nil {
		t.Fatalf("delete entry: %v", err)
	}
	_, err = st.GetEntry(dictID, entry1ID)
	if !errors.Is(err, sql.ErrNoRows) {
		t.Errorf("expected ErrNoRows after delete, got %v", err)
	}

	// --- DeleteDictionary (cascades to entries) ---
	if err := st.DeleteDictionary(projectID, dictID); err != nil {
		t.Fatalf("delete dictionary: %v", err)
	}
	dicts, _ = st.ListDictionaries(projectID)
	if len(dicts) != 0 {
		t.Errorf("expected 0 dictionaries after delete, got %d", len(dicts))
	}
	remaining, _ := st.ListEntries(dictID)
	if len(remaining) != 0 {
		t.Errorf("expected CASCADE to delete entries, got %d remaining", len(remaining))
	}
}
