// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package store

import (
	"path/filepath"
	"testing"
)

func TestCastProfileCRUDAndVersions(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "cast.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	projectID, err := st.CreateProject(ScriptProject{Title: "Cast Project"})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	voice := "Zephyr"
	lines := `["The first sample line."]`
	profileID, err := st.CreateCastProfile(projectID, CastProfile{
		Name:            "Narrator",
		Role:            "narrator",
		Description:     "Warm guide",
		VoiceName:       &voice,
		SampleLinesJSON: &lines,
		SortOrder:       2,
	})
	if err != nil {
		t.Fatalf("create cast profile: %v", err)
	}

	profile, err := st.GetCastProfile(profileID)
	if err != nil {
		t.Fatalf("get cast profile: %v", err)
	}
	if profile.ProjectID != projectID || profile.Name != "Narrator" || profile.VoiceName == nil || *profile.VoiceName != voice {
		t.Fatalf("unexpected profile: %#v", profile)
	}

	profiles, err := st.ListCastProfiles(projectID)
	if err != nil {
		t.Fatalf("list cast profiles: %v", err)
	}
	if len(profiles) != 1 {
		t.Fatalf("expected 1 profile, got %d", len(profiles))
	}

	updatedVoice := "Charon"
	if err := st.UpdateCastProfile(profileID, CastProfile{
		Name:        "Lead Narrator",
		Role:        "narrator",
		Description: "More authoritative",
		VoiceName:   &updatedVoice,
		SortOrder:   1,
	}); err != nil {
		t.Fatalf("update cast profile: %v", err)
	}

	versions, err := st.ListCastProfileVersions(profileID, 10)
	if err != nil {
		t.Fatalf("list versions: %v", err)
	}
	if len(versions) != 1 || versions[0].Name != "Narrator" {
		t.Fatalf("expected prior profile snapshot, got %#v", versions)
	}

	if err := st.RevertCastProfileVersion(profileID, versions[0].ID); err != nil {
		t.Fatalf("revert cast profile: %v", err)
	}
	reverted, err := st.GetCastProfile(profileID)
	if err != nil {
		t.Fatalf("get reverted profile: %v", err)
	}
	if reverted.Name != "Narrator" || reverted.VoiceName == nil || *reverted.VoiceName != voice {
		t.Fatalf("profile was not reverted: %#v", reverted)
	}

	versions, err = st.ListCastProfileVersions(profileID, 10)
	if err != nil {
		t.Fatalf("list versions after revert: %v", err)
	}
	if len(versions) != 2 {
		t.Fatalf("expected revert to snapshot current state, got %d versions", len(versions))
	}

	if err := st.DeleteCastProfile(profileID); err != nil {
		t.Fatalf("delete cast profile: %v", err)
	}
	if _, err := st.GetCastProfile(profileID); err == nil {
		t.Fatal("expected deleted cast profile to be missing")
	}
}
