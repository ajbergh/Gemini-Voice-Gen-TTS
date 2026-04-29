// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

package handler

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

func TestQcHandlerCRUD(t *testing.T) {
	st, err := store.New(filepath.Join(t.TempDir(), "qc-handler.db"))
	if err != nil {
		t.Fatalf("new store: %v", err)
	}
	defer st.Close()

	// Create project and segment prerequisites.
	projectID, err := st.CreateProject(store.ScriptProject{Title: "QC Handler Project"})
	if err != nil {
		t.Fatalf("create project: %v", err)
	}
	sectionID, err := st.CreateSection(store.ScriptSection{ProjectID: projectID, Title: "Ch 1", Kind: "chapter"})
	if err != nil {
		t.Fatalf("create section: %v", err)
	}
	segmentID, err := st.CreateSegment(store.ScriptSegment{ProjectID: projectID, SectionID: &sectionID, ScriptText: "Test line."})
	if err != nil {
		t.Fatalf("create segment: %v", err)
	}

	h := &QcHandler{Store: st}

	// -------------------------------------------------------------------------
	// 1. Create a QC issue.
	// -------------------------------------------------------------------------
	body, _ := json.Marshal(map[string]any{
		"segment_id": segmentID,
		"issue_type": "pronunciation",
		"severity":   "high",
		"note":       "Mispronounced 'nuclear'.",
	})
	createRR := httptest.NewRecorder()
	createReq := qcRequest(http.MethodPost, projectID, 0, 0, string(body))
	h.CreateQcIssue(createRR, createReq)
	if createRR.Code != http.StatusCreated {
		t.Fatalf("create status = %d: %s", createRR.Code, createRR.Body.String())
	}
	var created store.QcIssue
	if err := json.Unmarshal(createRR.Body.Bytes(), &created); err != nil {
		t.Fatalf("decode created issue: %v", err)
	}
	if created.ID == 0 || created.IssueType != "pronunciation" || created.Status != "open" {
		t.Fatalf("unexpected created issue: %#v", created)
	}

	// -------------------------------------------------------------------------
	// 2. List issues for project — expect 1.
	// -------------------------------------------------------------------------
	listRR := httptest.NewRecorder()
	h.ListProjectQcIssues(listRR, qcRequest(http.MethodGet, projectID, 0, 0, ""))
	if listRR.Code != http.StatusOK {
		t.Fatalf("list status = %d: %s", listRR.Code, listRR.Body.String())
	}
	var issues []store.QcIssue
	if err := json.Unmarshal(listRR.Body.Bytes(), &issues); err != nil {
		t.Fatalf("decode issues: %v", err)
	}
	if len(issues) != 1 {
		t.Fatalf("expected 1 issue, got %d", len(issues))
	}

	// -------------------------------------------------------------------------
	// 3. Resolve issue.
	// -------------------------------------------------------------------------
	resolveRR := httptest.NewRecorder()
	h.ResolveQcIssue(resolveRR, qcRequest(http.MethodPost, 0, created.ID, 0, ""))
	if resolveRR.Code != http.StatusOK {
		t.Fatalf("resolve status = %d: %s", resolveRR.Code, resolveRR.Body.String())
	}
	var resolved store.QcIssue
	if err := json.Unmarshal(resolveRR.Body.Bytes(), &resolved); err != nil {
		t.Fatalf("decode resolved: %v", err)
	}
	if resolved.Status != "resolved" {
		t.Errorf("expected status=resolved, got %q", resolved.Status)
	}

	// -------------------------------------------------------------------------
	// 4. Rollup — expect 1 resolved.
	// -------------------------------------------------------------------------
	rollupRR := httptest.NewRecorder()
	h.GetProjectQcRollup(rollupRR, qcRequest(http.MethodGet, projectID, 0, 0, ""))
	if rollupRR.Code != http.StatusOK {
		t.Fatalf("rollup status = %d: %s", rollupRR.Code, rollupRR.Body.String())
	}
	var rollup store.QcRollup
	if err := json.Unmarshal(rollupRR.Body.Bytes(), &rollup); err != nil {
		t.Fatalf("decode rollup: %v", err)
	}
	if rollup.ResolvedCount != 1 || rollup.OpenCount != 0 {
		t.Errorf("unexpected rollup: %+v", rollup)
	}

	// -------------------------------------------------------------------------
	// 5. Export CSV.
	// -------------------------------------------------------------------------
	exportReq := qcRequest(http.MethodGet, projectID, 0, 0, "")
	exportReq.URL.RawQuery = "format=csv"
	exportRR := httptest.NewRecorder()
	h.ExportQcIssues(exportRR, exportReq)
	if exportRR.Code != http.StatusOK {
		t.Fatalf("export csv status = %d: %s", exportRR.Code, exportRR.Body.String())
	}
	if ct := exportRR.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/csv") {
		t.Errorf("expected text/csv content type, got %q", ct)
	}

	// -------------------------------------------------------------------------
	// 6. Export Markdown.
	// -------------------------------------------------------------------------
	exportMdReq := qcRequest(http.MethodGet, projectID, 0, 0, "")
	exportMdReq.URL.RawQuery = "format=markdown"
	exportMdRR := httptest.NewRecorder()
	h.ExportQcIssues(exportMdRR, exportMdReq)
	if exportMdRR.Code != http.StatusOK {
		t.Fatalf("export markdown status = %d: %s", exportMdRR.Code, exportMdRR.Body.String())
	}
	if ct := exportMdRR.Header().Get("Content-Type"); !strings.HasPrefix(ct, "text/markdown") {
		t.Errorf("expected text/markdown content type, got %q", ct)
	}

	// -------------------------------------------------------------------------
	// 7. Delete issue.
	// -------------------------------------------------------------------------
	deleteRR := httptest.NewRecorder()
	h.DeleteQcIssue(deleteRR, qcRequest(http.MethodDelete, 0, created.ID, 0, ""))
	if deleteRR.Code != http.StatusOK {
		t.Fatalf("delete status = %d: %s", deleteRR.Code, deleteRR.Body.String())
	}
	listAfterRR := httptest.NewRecorder()
	h.ListProjectQcIssues(listAfterRR, qcRequest(http.MethodGet, projectID, 0, 0, ""))
	var afterIssues []store.QcIssue
	_ = json.Unmarshal(listAfterRR.Body.Bytes(), &afterIssues)
	if len(afterIssues) != 0 {
		t.Fatalf("expected 0 issues after delete, got %d", len(afterIssues))
	}
}

// qcRequest builds a test HTTP request with path values set for QC handler tests.
// projectID populates {id}, issueID populates {issueId}, takeID populates {takeId}.
func qcRequest(method string, projectID, issueID, takeID int64, body string) *http.Request {
	if body == "" {
		body = "{}"
	}
	req := httptest.NewRequest(method, "/", strings.NewReader(body))
	if projectID > 0 {
		req.SetPathValue("id", int64PathValue(projectID))
	}
	if issueID > 0 {
		req.SetPathValue("issueId", int64PathValue(issueID))
	}
	if takeID > 0 {
		req.SetPathValue("takeId", int64PathValue(takeID))
	}
	return req
}
