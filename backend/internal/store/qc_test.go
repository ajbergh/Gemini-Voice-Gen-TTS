// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package store

import (
	"path/filepath"
	"testing"
)

func TestQcIssueCRUD(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "qc-test.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	// Create prerequisite project and segment.
	projID, err := st.CreateProject(ScriptProject{Title: "QC Test Project"})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	sectionID, err := st.CreateSection(ScriptSection{ProjectID: projID, Title: "Ch 1", Kind: "chapter", SortOrder: 0})
	if err != nil {
		t.Fatalf("create section: %v", err)
	}
	segID, err := st.CreateSegment(ScriptSegment{ProjectID: projID, SectionID: &sectionID, ScriptText: "Hello world."})
	if err != nil {
		t.Fatalf("create segment: %v", err)
	}

	// -------------------------------------------------------------------------
	// 1. Create a QC issue.
	// -------------------------------------------------------------------------
	issueID, err := st.CreateQcIssue(QcIssue{
		ProjectID: projID,
		SectionID: &sectionID,
		SegmentID: segID,
		IssueType: "pacing",
		Severity:  "medium",
		Note:      "Too fast in the middle.",
	})
	if err != nil {
		t.Fatalf("create qc issue: %v", err)
	}
	if issueID <= 0 {
		t.Fatalf("expected positive issue ID, got %d", issueID)
	}

	// -------------------------------------------------------------------------
	// 2. List issues for project — expect 1, status=open.
	// -------------------------------------------------------------------------
	issues, err := st.ListProjectQcIssues(projID, "")
	if err != nil {
		t.Fatalf("list project qc issues: %v", err)
	}
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}
	if issues[0].Status != "open" {
		t.Errorf("expected status=open, got %q", issues[0].Status)
	}
	if issues[0].IssueType != "pacing" {
		t.Errorf("expected issue_type=pacing, got %q", issues[0].IssueType)
	}

	// -------------------------------------------------------------------------
	// 3. Get issue.
	// -------------------------------------------------------------------------
	got, err := st.GetQcIssue(projID, issueID)
	if err != nil {
		t.Fatalf("get qc issue: %v", err)
	}
	if got.Note != "Too fast in the middle." {
		t.Errorf("unexpected note: %q", got.Note)
	}

	// -------------------------------------------------------------------------
	// 4. Update issue — change severity to high.
	// -------------------------------------------------------------------------
	update := *got
	update.Severity = "high"
	if err := st.UpdateQcIssue(projID, issueID, update); err != nil {
		t.Fatalf("update qc issue: %v", err)
	}
	updated, err := st.GetQcIssue(projID, issueID)
	if err != nil {
		t.Fatalf("get after update: %v", err)
	}
	if updated.Severity != "high" {
		t.Errorf("expected severity=high after update, got %q", updated.Severity)
	}

	// -------------------------------------------------------------------------
	// 5. Resolve issue.
	// -------------------------------------------------------------------------
	if err := st.ResolveQcIssue(projID, issueID); err != nil {
		t.Fatalf("resolve qc issue: %v", err)
	}
	resolved, err := st.GetQcIssue(projID, issueID)
	if err != nil {
		t.Fatalf("get after resolve: %v", err)
	}
	if resolved.Status != "resolved" {
		t.Errorf("expected status=resolved, got %q", resolved.Status)
	}

	// -------------------------------------------------------------------------
	// 6. Rollup — 1 resolved, 0 open.
	// -------------------------------------------------------------------------
	rollup, err := st.GetProjectQcRollup(projID)
	if err != nil {
		t.Fatalf("get rollup: %v", err)
	}
	if rollup.OpenCount != 0 {
		t.Errorf("expected 0 open, got %d", rollup.OpenCount)
	}
	if rollup.ResolvedCount != 1 {
		t.Errorf("expected 1 resolved, got %d", rollup.ResolvedCount)
	}

	// -------------------------------------------------------------------------
	// 7. Add a second issue, list segment-scoped.
	// -------------------------------------------------------------------------
	id2, err := st.CreateQcIssue(QcIssue{
		ProjectID: projID,
		SegmentID: segID,
		IssueType: "artifact",
		Severity:  "low",
		Note:      "Background hum.",
	})
	if err != nil {
		t.Fatalf("create second qc issue: %v", err)
	}
	segIssues, err := st.ListSegmentQcIssues(projID, segID)
	if err != nil {
		t.Fatalf("list segment qc issues: %v", err)
	}
	if len(segIssues) != 2 {
		t.Fatalf("expected 2 segment issues, got %d", len(segIssues))
	}

	// -------------------------------------------------------------------------
	// 8. ListSegmentQcStatus — open count per segment (only id2 is open).
	// -------------------------------------------------------------------------
	statuses, err := st.ListSegmentQcStatus(projID)
	if err != nil {
		t.Fatalf("list segment qc status: %v", err)
	}
	if len(statuses) != 1 {
		t.Fatalf("expected 1 segment with open issues, got %d", len(statuses))
	}
	if statuses[0].OpenCount != 1 {
		t.Errorf("expected open_count=1, got %d", statuses[0].OpenCount)
	}

	// -------------------------------------------------------------------------
	// 9. Delete issue.
	// -------------------------------------------------------------------------
	if err := st.DeleteQcIssue(projID, id2); err != nil {
		t.Fatalf("delete qc issue: %v", err)
	}
	remaining, err := st.ListProjectQcIssues(projID, "")
	if err != nil {
		t.Fatalf("list after delete: %v", err)
	}
	if len(remaining) != 1 {
		t.Fatalf("expected 1 issue after delete, got %d", len(remaining))
	}

	// -------------------------------------------------------------------------
	// 10. SetTakeStatus — create a take and set it to approved.
	// -------------------------------------------------------------------------
	voiceName := "Kore"
	audioPath := "/tmp/test.pcm"
	takeID, err := st.CreateTake(SegmentTake{
		ProjectID: projID,
		SegmentID: segID,
		VoiceName: &voiceName,
		AudioPath: &audioPath,
	})
	if err != nil {
		t.Fatalf("create take: %v", err)
	}
	if err := st.SetTakeStatus(projID, takeID, "approved"); err != nil {
		t.Fatalf("set take status: %v", err)
	}
	take, err := st.GetTake(projID, takeID)
	if err != nil {
		t.Fatalf("get take after approve: %v", err)
	}
	if take.Status != "approved" {
		t.Errorf("expected take status=approved, got %q", take.Status)
	}
}
