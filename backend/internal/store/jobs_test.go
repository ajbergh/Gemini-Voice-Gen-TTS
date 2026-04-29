// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package store

import (
	"path/filepath"
	"testing"
)

func TestJobProgressPersistence(t *testing.T) {
	st, err := New(filepath.Join(t.TempDir(), "jobs.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	if err := st.UpsertJobProgress(JobProgressUpdate{
		ID:         "job_1",
		Type:       "tts",
		Status:     "processing",
		Message:    "Generating speech...",
		Percent:    10,
		ProjectID:  "project_1",
		SegmentID:  "segment_1",
		TotalItems: 2,
	}); err != nil {
		t.Fatalf("insert job progress: %v", err)
	}

	job, err := st.GetJob("job_1")
	if err != nil {
		t.Fatalf("get job: %v", err)
	}
	if job.Type != "tts" || job.Status != "processing" || job.Percent != 10 {
		t.Fatalf("unexpected job state: %#v", job)
	}
	if job.ProjectID == nil || *job.ProjectID != "project_1" {
		t.Fatalf("expected project ID to persist, got %#v", job.ProjectID)
	}
	if job.Message == nil || *job.Message != "Generating speech..." {
		t.Fatalf("expected message to persist, got %#v", job.Message)
	}

	if err := st.UpsertJobProgress(JobProgressUpdate{
		ID:             "job_1",
		Type:           "tts",
		Status:         "complete",
		Message:        "Audio ready",
		Percent:        100,
		CompletedItems: 1,
	}); err != nil {
		t.Fatalf("update job progress: %v", err)
	}

	job, err = st.GetJob("job_1")
	if err != nil {
		t.Fatalf("get updated job: %v", err)
	}
	if job.Status != "complete" || job.Percent != 100 || job.CompletedItems != 1 {
		t.Fatalf("unexpected updated job state: %#v", job)
	}
	if job.TotalItems != 2 {
		t.Fatalf("expected total item count to be preserved, got %d", job.TotalItems)
	}
	if job.CompletedAt == nil || *job.CompletedAt == "" {
		t.Fatal("expected terminal status to set completed_at")
	}

	jobs, err := st.ListJobs(10)
	if err != nil {
		t.Fatalf("list jobs: %v", err)
	}
	if len(jobs) != 1 || jobs[0].ID != "job_1" {
		t.Fatalf("unexpected jobs list: %#v", jobs)
	}
}
