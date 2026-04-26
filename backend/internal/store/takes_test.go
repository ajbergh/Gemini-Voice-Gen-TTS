// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package store

import (
	"path/filepath"
	"testing"
)

func TestSegmentTakeCRUD(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "takes.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	// Create a project and segment first (foreign key constraints).
	projectID, err := st.CreateProject(ScriptProject{Title: "Test Project"})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	segmentID, err := st.CreateSegment(ScriptSegment{
		ProjectID:  projectID,
		ScriptText: "Hello, world.",
		Status:     "rendered",
	})
	if err != nil {
		t.Fatalf("create segment: %v", err)
	}
	otherProjectID, err := st.CreateProject(ScriptProject{Title: "Other Project"})
	if err != nil {
		t.Fatalf("create other project: %v", err)
	}
	otherSegmentID, err := st.CreateSegment(ScriptSegment{
		ProjectID:  otherProjectID,
		ScriptText: "Wrong project.",
		Status:     "draft",
	})
	if err != nil {
		t.Fatalf("create other segment: %v", err)
	}

	voice := "Zephyr"
	prov := "google"
	sampleRate := 24000
	channels := 1
	format := "pcm_s16le"
	peak := -1.25
	rms := -18.5
	providerVoice := "alloy"
	appVoice := "Zephyr"
	promptHash := "prompt-hash"

	// --- Create first take ---
	take1ID, err := st.CreateTake(SegmentTake{
		ProjectID:        projectID,
		SegmentID:        segmentID,
		ScriptText:       "Hello, world.",
		VoiceName:        &voice,
		Provider:         &prov,
		ProviderVoice:    &providerVoice,
		AppVoiceName:     &appVoice,
		PromptHash:       &promptHash,
		PeakDbfs:         &peak,
		RmsDbfs:          &rms,
		ClippingDetected: true,
		SampleRate:       &sampleRate,
		Channels:         &channels,
		Format:           &format,
		Status:           "rendered",
	})
	if err != nil {
		t.Fatalf("create take 1: %v", err)
	}

	take1, err := st.GetTake(projectID, take1ID)
	if err != nil {
		t.Fatalf("get take 1: %v", err)
	}
	if take1.TakeNumber != 1 {
		t.Errorf("expected take_number=1, got %d", take1.TakeNumber)
	}
	if take1.VoiceName == nil || *take1.VoiceName != "Zephyr" {
		t.Errorf("unexpected voice_name: %v", take1.VoiceName)
	}
	if take1.ContentHash == "" {
		t.Error("expected non-empty content hash")
	}
	if take1.PeakDbfs == nil || *take1.PeakDbfs != peak || take1.RmsDbfs == nil || *take1.RmsDbfs != rms {
		t.Fatalf("audio analysis metadata not persisted: %#v", take1)
	}
	if !take1.ClippingDetected || take1.SampleRate == nil || *take1.SampleRate != sampleRate || take1.Channels == nil || *take1.Channels != channels || take1.Format == nil || *take1.Format != format {
		t.Fatalf("audio format metadata not persisted: %#v", take1)
	}
	if take1.ProviderVoice == nil || *take1.ProviderVoice != providerVoice || take1.AppVoiceName == nil || *take1.AppVoiceName != appVoice || take1.PromptHash == nil || *take1.PromptHash != promptHash {
		t.Fatalf("render reproducibility metadata not persisted: %#v", take1)
	}
	if _, err := st.GetTakeForSegment(projectID, otherSegmentID, take1ID); err == nil {
		t.Fatal("expected scoped get to reject the wrong segment")
	}
	if _, err := st.CreateTake(SegmentTake{
		ProjectID:  projectID,
		SegmentID:  otherSegmentID,
		ScriptText: "Mismatched ownership.",
	}); err == nil {
		t.Fatal("expected create take to reject a segment from another project")
	}

	// --- Create second take — take_number should be 2 ---
	take2ID, err := st.CreateTake(SegmentTake{
		ProjectID:  projectID,
		SegmentID:  segmentID,
		ScriptText: "Hello, world.",
		Status:     "rendered",
	})
	if err != nil {
		t.Fatalf("create take 2: %v", err)
	}

	take2, err := st.GetTake(projectID, take2ID)
	if err != nil {
		t.Fatalf("get take 2: %v", err)
	}
	if take2.TakeNumber != 2 {
		t.Errorf("expected take_number=2, got %d", take2.TakeNumber)
	}

	// --- List takes: newest first ---
	takes, err := st.ListSegmentTakes(projectID, segmentID)
	if err != nil {
		t.Fatalf("list takes: %v", err)
	}
	if len(takes) != 2 {
		t.Fatalf("expected 2 takes, got %d", len(takes))
	}
	if takes[0].TakeNumber != 2 {
		t.Errorf("expected newest take first, got take_number=%d", takes[0].TakeNumber)
	}

	// --- Notes ---
	noteID, err := st.CreateTakeNote(take1ID, "Sounds a bit rushed.")
	if err != nil {
		t.Fatalf("create take note: %v", err)
	}
	notes, err := st.ListTakeNotes(take1ID)
	if err != nil {
		t.Fatalf("list take notes: %v", err)
	}
	if len(notes) != 1 || notes[0].Note != "Sounds a bit rushed." {
		t.Errorf("unexpected notes: %v", notes)
	}
	if err := st.DeleteTakeNoteForTake(take2ID, noteID); err == nil {
		t.Fatal("expected scoped note delete to reject the wrong take")
	}

	if err := st.DeleteTakeNote(noteID); err != nil {
		t.Fatalf("delete take note: %v", err)
	}
	notes, _ = st.ListTakeNotes(take1ID)
	if len(notes) != 0 {
		t.Errorf("expected no notes after delete, got %d", len(notes))
	}

	// --- Delete take ---
	if err := st.DeleteTakeForSegment(projectID, otherSegmentID, take1ID); err == nil {
		t.Fatal("expected scoped take delete to reject the wrong segment")
	}
	if err := st.DeleteTake(projectID, take1ID); err != nil {
		t.Fatalf("delete take: %v", err)
	}
	takes, _ = st.ListSegmentTakes(projectID, segmentID)
	if len(takes) != 1 {
		t.Errorf("expected 1 take after delete, got %d", len(takes))
	}

	// --- Not found ---
	if err := st.DeleteTake(projectID, take1ID); err == nil {
		t.Error("expected error deleting already-deleted take")
	}
}
