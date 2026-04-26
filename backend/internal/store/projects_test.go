// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package store

import (
	"path/filepath"
	"testing"
)

func TestScriptProjectSectionSegmentPersistence(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "projects.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	voice := "Kore"
	provider := "gemini"
	model := "gemini-2.5-flash-preview-tts"
	fallbackProvider := "gemini"
	fallbackModel := "gemini-2.5-flash-preview-tts"
	projectID, err := st.CreateProject(ScriptProject{
		Title:            "Chapter Work",
		Kind:             "audiobook",
		Status:           "active",
		DefaultVoiceName: &voice,
		DefaultProvider:  &provider,
		DefaultModel:     &model,
		FallbackProvider: &fallbackProvider,
		FallbackModel:    &fallbackModel,
	})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}

	project, err := st.GetProject(projectID)
	if err != nil {
		t.Fatalf("get project: %v", err)
	}
	if project.Title != "Chapter Work" || project.Status != "active" {
		t.Fatalf("unexpected project: %#v", project)
	}
	if project.DefaultVoiceName == nil || *project.DefaultVoiceName != "Kore" {
		t.Fatalf("expected default voice to persist, got %#v", project.DefaultVoiceName)
	}
	if project.DefaultProvider == nil || *project.DefaultProvider != provider || project.FallbackProvider == nil || *project.FallbackProvider != fallbackProvider {
		t.Fatalf("expected provider defaults to persist, got %#v", project)
	}

	sectionID, err := st.CreateSection(ScriptSection{
		ProjectID: projectID,
		Kind:      "chapter",
		Title:     "Chapter 1",
		SortOrder: 1,
	})
	if err != nil {
		t.Fatalf("create section: %v", err)
	}

	segmentID, err := st.CreateSegment(ScriptSegment{
		ProjectID:        projectID,
		SectionID:        &sectionID,
		Title:            "Opening",
		ScriptText:       "The first line.",
		VoiceName:        &voice,
		Provider:         &provider,
		Model:            &model,
		FallbackProvider: &fallbackProvider,
		FallbackModel:    &fallbackModel,
		Status:           "rendered",
		SortOrder:        1,
	})
	if err != nil {
		t.Fatalf("create segment: %v", err)
	}

	segments, err := st.ListProjectSegments(projectID)
	if err != nil {
		t.Fatalf("list segments: %v", err)
	}
	if len(segments) != 1 || segments[0].ContentHash == "" {
		t.Fatalf("unexpected segment list: %#v", segments)
	}
	if segments[0].Provider == nil || *segments[0].Provider != provider || segments[0].FallbackProvider == nil || *segments[0].FallbackProvider != fallbackProvider {
		t.Fatalf("expected segment provider fields to persist, got %#v", segments[0])
	}

	err = st.UpdateSegment(projectID, segmentID, ScriptSegment{
		SectionID:  &sectionID,
		Title:      "Opening",
		ScriptText: "The first line changed.",
		VoiceName:  &voice,
		Status:     "rendered",
		SortOrder:  1,
	})
	if err != nil {
		t.Fatalf("update segment: %v", err)
	}

	segments, err = st.ListProjectSegments(projectID)
	if err != nil {
		t.Fatalf("list updated segments: %v", err)
	}
	if segments[0].Status != "changed" {
		t.Fatalf("expected rendered text edit to mark segment changed, got %q", segments[0].Status)
	}

	if err := st.DeleteSection(projectID, sectionID); err != nil {
		t.Fatalf("delete section: %v", err)
	}
	segments, err = st.ListProjectSegments(projectID)
	if err != nil {
		t.Fatalf("list segments after section delete: %v", err)
	}
	if segments[0].SectionID != nil {
		t.Fatalf("expected deleted section to unassign segment, got %#v", segments[0].SectionID)
	}

	if err := st.ArchiveProject(projectID); err != nil {
		t.Fatalf("archive project: %v", err)
	}
	project, err = st.GetProject(projectID)
	if err != nil {
		t.Fatalf("get archived project: %v", err)
	}
	if project.Status != "archived" {
		t.Fatalf("expected archived status, got %q", project.Status)
	}
}
