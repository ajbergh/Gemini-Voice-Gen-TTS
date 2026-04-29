// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package store

import (
	"path/filepath"
	"testing"
)

func TestStyleCRUDAndVersions(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "styles-test.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	// -------------------------------------------------------------------------
	// 1. List global styles — expect 8 seed styles.
	// -------------------------------------------------------------------------
	all, err := st.ListStyles(0)
	if err != nil {
		t.Fatalf("list global styles: %v", err)
	}
	if len(all) != 8 {
		t.Fatalf("expected 8 built-in styles, got %d", len(all))
	}
	for _, s := range all {
		if !s.IsBuiltin {
			t.Errorf("seed style %q should have is_builtin=true", s.Name)
		}
	}

	// -------------------------------------------------------------------------
	// 2. Create a user style.
	// -------------------------------------------------------------------------
	pacing := "measured"
	energy := "subdued"
	id, err := st.CreateStyle(PerformanceStyle{
		Scope:         "global",
		Name:          "My Custom Style",
		Description:   "A test style.",
		Category:      "custom",
		Pacing:        &pacing,
		Energy:        &energy,
		DirectorNotes: "Speak calmly.",
	})
	if err != nil {
		t.Fatalf("create style: %v", err)
	}

	// GetStyle round-trip.
	got, err := st.GetStyle(id)
	if err != nil {
		t.Fatalf("get style: %v", err)
	}
	if got.Name != "My Custom Style" || got.Pacing == nil || *got.Pacing != "measured" {
		t.Fatalf("unexpected style: %#v", got)
	}
	if got.IsBuiltin {
		t.Error("user style should not be builtin")
	}

	// -------------------------------------------------------------------------
	// 3. ListStyles returns seed + user style.
	// -------------------------------------------------------------------------
	all2, err := st.ListStyles(0)
	if err != nil {
		t.Fatalf("list after create: %v", err)
	}
	if len(all2) != 9 {
		t.Fatalf("expected 9 styles after create, got %d", len(all2))
	}

	// -------------------------------------------------------------------------
	// 4. UpdateStyle snapshots the prior version.
	// -------------------------------------------------------------------------
	updated, err := st.UpdateStyle(id, PerformanceStyle{
		Name:          "My Updated Style",
		Description:   "Updated desc.",
		Category:      "custom",
		DirectorNotes: "Speak more precisely.",
	})
	if err != nil {
		t.Fatalf("update style: %v", err)
	}
	if updated.Name != "My Updated Style" {
		t.Fatalf("expected updated name, got %q", updated.Name)
	}

	// One version should exist (the snapshot of the original state).
	versions, err := st.ListStyleVersions(id)
	if err != nil {
		t.Fatalf("list versions: %v", err)
	}
	if len(versions) != 1 {
		t.Fatalf("expected 1 version, got %d", len(versions))
	}
	if versions[0].Name != "My Custom Style" {
		t.Fatalf("expected version to capture prior name, got %q", versions[0].Name)
	}

	// -------------------------------------------------------------------------
	// 5. RevertStyleVersion restores prior state (and creates another snapshot).
	// -------------------------------------------------------------------------
	reverted, err := st.RevertStyleVersion(id, versions[0].ID)
	if err != nil {
		t.Fatalf("revert style version: %v", err)
	}
	if reverted.Name != "My Custom Style" {
		t.Fatalf("expected reverted name, got %q", reverted.Name)
	}
	// Two versions now (original + post-update snapshot created by revert).
	versions2, err := st.ListStyleVersions(id)
	if err != nil {
		t.Fatalf("list versions after revert: %v", err)
	}
	if len(versions2) != 2 {
		t.Fatalf("expected 2 versions after revert, got %d", len(versions2))
	}

	// -------------------------------------------------------------------------
	// 6. DeleteStyle removes a user style but protects builtins.
	// -------------------------------------------------------------------------
	if err := st.DeleteStyle(id); err != nil {
		t.Fatalf("delete user style: %v", err)
	}
	// Builtin delete should fail.
	if err := st.DeleteStyle(1); err == nil {
		t.Error("expected error deleting builtin style, got nil")
	}

	// ListStyles should be back to 8.
	final, err := st.ListStyles(0)
	if err != nil {
		t.Fatalf("final list: %v", err)
	}
	if len(final) != 8 {
		t.Fatalf("expected 8 styles after delete, got %d", len(final))
	}

	// -------------------------------------------------------------------------
	// 7. Project-scoped style only visible from that project.
	// -------------------------------------------------------------------------
	projectID, err := st.CreateProject(ScriptProject{Title: "Style test project"})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	projStyleID, err := st.CreateStyle(PerformanceStyle{
		Scope:         "project",
		ProjectID:     &projectID,
		Name:          "Project Style",
		Category:      "custom",
		DirectorNotes: "Project-only delivery.",
	})
	if err != nil {
		t.Fatalf("create project style: %v", err)
	}
	// Visible when querying with that project ID.
	withProject, err := st.ListStyles(projectID)
	if err != nil {
		t.Fatalf("list with project: %v", err)
	}
	found := false
	for _, s := range withProject {
		if s.ID == projStyleID {
			found = true
			break
		}
	}
	if !found {
		t.Error("project-scoped style not returned when queried with project ID")
	}
	// Not visible in global-only list.
	globalOnly, err := st.ListStyles(0)
	if err != nil {
		t.Fatalf("list global only: %v", err)
	}
	for _, s := range globalOnly {
		if s.ID == projStyleID {
			t.Error("project-scoped style should NOT appear in global-only list")
		}
	}
}
