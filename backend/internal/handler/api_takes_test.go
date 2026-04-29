// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

func TestTakesHandlerScopesNestedRoutes(t *testing.T) {
	st, err := store.New(filepath.Join(t.TempDir(), "takes-handler.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	projectID, err := st.CreateProject(store.ScriptProject{Title: "Project"})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	segmentID, err := st.CreateSegment(store.ScriptSegment{
		ProjectID:  projectID,
		ScriptText: "Segment one.",
	})
	if err != nil {
		t.Fatalf("create segment: %v", err)
	}
	otherSegmentID, err := st.CreateSegment(store.ScriptSegment{
		ProjectID:  projectID,
		ScriptText: "Segment two.",
	})
	if err != nil {
		t.Fatalf("create other segment: %v", err)
	}
	takeID, err := st.CreateTake(store.SegmentTake{
		ProjectID:  projectID,
		SegmentID:  segmentID,
		ScriptText: "Segment one.",
	})
	if err != nil {
		t.Fatalf("create take: %v", err)
	}
	otherTakeID, err := st.CreateTake(store.SegmentTake{
		ProjectID:  projectID,
		SegmentID:  otherSegmentID,
		ScriptText: "Segment two.",
	})
	if err != nil {
		t.Fatalf("create other take: %v", err)
	}
	noteID, err := st.CreateTakeNote(takeID, "Scoped note")
	if err != nil {
		t.Fatalf("create note: %v", err)
	}

	h := &TakesHandler{Store: st, AudioCacheDir: t.TempDir()}

	t.Run("get take rejects wrong segment", func(t *testing.T) {
		rr := httptest.NewRecorder()
		req := takeRequest(http.MethodGet, projectID, otherSegmentID, takeID, 0, "")
		h.GetTake(rr, req)
		if rr.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d: %s", rr.Code, rr.Body.String())
		}
	})

	t.Run("create take rejects segment from another project", func(t *testing.T) {
		otherProjectID, err := st.CreateProject(store.ScriptProject{Title: "Other"})
		if err != nil {
			t.Fatalf("create other project: %v", err)
		}
		rr := httptest.NewRecorder()
		req := takeRequest(http.MethodPost, otherProjectID, segmentID, 0, 0, `{"script_text":"bad"}`)
		h.CreateTake(rr, req)
		if rr.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d: %s", rr.Code, rr.Body.String())
		}
	})

	t.Run("delete note rejects note from another take", func(t *testing.T) {
		rr := httptest.NewRecorder()
		req := takeRequest(http.MethodDelete, projectID, otherSegmentID, otherTakeID, noteID, "")
		h.DeleteTakeNote(rr, req)
		if rr.Code != http.StatusNotFound {
			t.Fatalf("expected 404, got %d: %s", rr.Code, rr.Body.String())
		}

		notes, err := st.ListTakeNotes(takeID)
		if err != nil {
			t.Fatalf("list notes: %v", err)
		}
		if len(notes) != 1 {
			t.Fatalf("expected original note to remain, got %d notes", len(notes))
		}
	})
}

func takeRequest(method string, projectID, segmentID, takeID, noteID int64, body string) *http.Request {
	var reader *strings.Reader
	if body == "" {
		reader = strings.NewReader("{}")
	} else {
		reader = strings.NewReader(body)
	}
	req := httptest.NewRequest(method, "/", reader)
	req.SetPathValue("id", int64PathValue(projectID))
	req.SetPathValue("segmentId", int64PathValue(segmentID))
	if takeID > 0 {
		req.SetPathValue("takeId", int64PathValue(takeID))
	}
	if noteID > 0 {
		req.SetPathValue("noteId", int64PathValue(noteID))
	}
	return req
}

func int64PathValue(v int64) string {
	return strconv.FormatInt(v, 10)
}
