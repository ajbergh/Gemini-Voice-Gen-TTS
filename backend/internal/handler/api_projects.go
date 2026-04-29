// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_projects.go implements HTTP handlers for durable script
// projects, sections, and segments.
package handler

import (
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// ProjectsHandler handles /api/projects endpoints.
type ProjectsHandler struct {
	Store *store.Store
}

type importPreviewSegment struct {
	ScriptText string `json:"script_text"`
}

type importPreviewSection struct {
	Title    string                 `json:"title"`
	Kind     string                 `json:"kind"`
	Segments []importPreviewSegment `json:"segments"`
}

type importPreviewResponse struct {
	Sections            []importPreviewSection `json:"sections"`
	UnsectionedSegments []importPreviewSegment `json:"unsectioned_segments"`
	SectionCount        int                    `json:"section_count"`
	SegmentCount        int                    `json:"segment_count"`
}

// ListProjects returns all script projects.
func (h *ProjectsHandler) ListProjects(w http.ResponseWriter, r *http.Request) {
	projects, err := h.Store.ListProjects()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list projects")
		return
	}
	if projects == nil {
		projects = []store.ScriptProject{}
	}
	writeJSON(w, http.StatusOK, projects)
}

// ListProjectSummaries returns list-level counts for every script project.
func (h *ProjectsHandler) ListProjectSummaries(w http.ResponseWriter, r *http.Request) {
	summaries, err := h.Store.ListProjectSummaries()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list project summaries")
		return
	}
	if summaries == nil {
		summaries = []store.ScriptProjectSummary{}
	}
	writeJSON(w, http.StatusOK, summaries)
}

// CreateProject creates a new script project.
func (h *ProjectsHandler) CreateProject(w http.ResponseWriter, r *http.Request) {
	var req store.ScriptProject
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}

	id, err := h.Store.CreateProject(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create project")
		return
	}
	project, err := h.Store.GetProject(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read created project")
		return
	}
	writeJSON(w, http.StatusCreated, project)
}

// GetProject returns one script project.
func (h *ProjectsHandler) GetProject(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}
	project, err := h.Store.GetProject(projectID)
	if err != nil {
		writeStoreError(w, err, "project not found", "failed to get project")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

// UpdateProject updates one script project.
func (h *ProjectsHandler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}
	var req store.ScriptProject
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if err := h.Store.UpdateProject(projectID, req); err != nil {
		writeStoreError(w, err, "project not found", "failed to update project")
		return
	}
	project, err := h.Store.GetProject(projectID)
	if err != nil {
		writeStoreError(w, err, "project not found", "failed to get updated project")
		return
	}
	writeJSON(w, http.StatusOK, project)
}

// ArchiveProject marks a project archived.
func (h *ProjectsHandler) ArchiveProject(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}
	if err := h.Store.ArchiveProject(projectID); err != nil {
		writeStoreError(w, err, "project not found", "failed to archive project")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "archived"})
}

// ListSections returns sections for one project.
func (h *ProjectsHandler) ListSections(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	sections, err := h.Store.ListProjectSections(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list sections")
		return
	}
	if sections == nil {
		sections = []store.ScriptSection{}
	}
	writeJSON(w, http.StatusOK, sections)
}

// CreateSection creates a project section.
func (h *ProjectsHandler) CreateSection(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	var req store.ScriptSection
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	req.ProjectID = projectID
	id, err := h.Store.CreateSection(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create section")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

// UpdateSection updates a project section.
func (h *ProjectsHandler) UpdateSection(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	sectionID, ok := parsePathInt64(w, r, "sectionId", "invalid section ID")
	if !ok {
		return
	}
	var req store.ScriptSection
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		writeError(w, http.StatusBadRequest, "title is required")
		return
	}
	if err := h.Store.UpdateSection(projectID, sectionID, req); err != nil {
		writeStoreError(w, err, "section not found", "failed to update section")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteSection deletes a project section.
func (h *ProjectsHandler) DeleteSection(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	sectionID, ok := parsePathInt64(w, r, "sectionId", "invalid section ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteSection(projectID, sectionID); err != nil {
		writeStoreError(w, err, "section not found", "failed to delete section")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// ListSegments returns segments for one project.
func (h *ProjectsHandler) ListSegments(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	segments, err := h.Store.ListProjectSegments(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list segments")
		return
	}
	if segments == nil {
		segments = []store.ScriptSegment{}
	}
	writeJSON(w, http.StatusOK, segments)
}

// CreateSegment creates a project segment.
func (h *ProjectsHandler) CreateSegment(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	var req store.ScriptSegment
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.ProjectID = projectID
	id, err := h.Store.CreateSegment(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create segment")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]int64{"id": id})
}

// UpdateSegment updates a project segment.
func (h *ProjectsHandler) UpdateSegment(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	segmentID, ok := parsePathInt64(w, r, "segmentId", "invalid segment ID")
	if !ok {
		return
	}
	var req store.ScriptSegment
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if err := h.Store.UpdateSegment(projectID, segmentID, req); err != nil {
		writeStoreError(w, err, "segment not found", "failed to update segment")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "updated"})
}

// DeleteSegment deletes a project segment.
func (h *ProjectsHandler) DeleteSegment(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}
	segmentID, ok := parsePathInt64(w, r, "segmentId", "invalid segment ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteSegment(projectID, segmentID); err != nil {
		writeStoreError(w, err, "segment not found", "failed to delete segment")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "deleted"})
}

// PreviewProjectImport parses import text without writing sections or segments.
func (h *ProjectsHandler) PreviewProjectImport(w http.ResponseWriter, r *http.Request) {
	if _, ok := h.requireProject(w, r); !ok {
		return
	}

	var req struct {
		Text     string `json:"text"`
		Filename string `json:"filename"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		writeError(w, http.StatusBadRequest, "text is required")
		return
	}

	writeJSON(w, http.StatusOK, parseProjectImport(req.Text))
}

// ImportProject parses a plain-text or Markdown document into sections and
// segments and appends them to the project.
//
// Request body: { "text": "...", "filename": "optional.md" }
// Response body: { "sections_created": N, "segments_created": M }
//
// Parsing rules:
//   - The document is split on blank lines (paragraph boundaries).
//   - A paragraph whose first line starts with "#" (Markdown heading) becomes
//     a new section.  Leading "#" characters and whitespace are stripped from
//     the title.
//   - Any other non-empty paragraph becomes a segment appended to the most
//     recently created section (or unsectioned if no section has been seen yet).
//   - Paragraphs that are only whitespace are skipped.
func (h *ProjectsHandler) ImportProject(w http.ResponseWriter, r *http.Request) {
	projectID, ok := h.requireProject(w, r)
	if !ok {
		return
	}

	var req struct {
		Text     string `json:"text"`
		Filename string `json:"filename"`
	}
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		writeError(w, http.StatusBadRequest, "text is required")
		return
	}

	preview := parseProjectImport(req.Text)

	var (
		sectionOrder    int
		segmentOrder    int
		sectionsCreated int
		segmentsCreated int
	)

	// Fetch current max sort orders so new items are appended after existing ones.
	if existingSections, err := h.Store.ListProjectSections(projectID); err == nil && len(existingSections) > 0 {
		for _, s := range existingSections {
			if s.SortOrder >= sectionOrder {
				sectionOrder = s.SortOrder + 1
			}
		}
	}
	if existingSegments, err := h.Store.ListProjectSegments(projectID); err == nil && len(existingSegments) > 0 {
		for _, s := range existingSegments {
			if s.SortOrder >= segmentOrder {
				segmentOrder = s.SortOrder + 1
			}
		}
	}

	createSegment := func(sectionID *int64, segment importPreviewSegment) bool {
		seg := store.ScriptSegment{
			ProjectID:  projectID,
			SectionID:  sectionID,
			ScriptText: segment.ScriptText,
			Status:     "draft",
			SortOrder:  segmentOrder,
		}
		if _, err := h.Store.CreateSegment(seg); err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create segment")
			return false
		}
		segmentOrder++
		segmentsCreated++
		return true
	}

	for _, segment := range preview.UnsectionedSegments {
		if !createSegment(nil, segment) {
			return
		}
	}

	for _, section := range preview.Sections {
		id, err := h.Store.CreateSection(store.ScriptSection{
			ProjectID: projectID,
			Kind:      section.Kind,
			Title:     section.Title,
			SortOrder: sectionOrder,
		})
		if err != nil {
			writeError(w, http.StatusInternalServerError, "failed to create section")
			return
		}
		sectionOrder++
		sectionsCreated++

		sectionID := id
		for _, segment := range section.Segments {
			if !createSegment(&sectionID, segment) {
				return
			}
		}
	}

	writeJSON(w, http.StatusCreated, map[string]int{
		"sections_created": sectionsCreated,
		"segments_created": segmentsCreated,
	})
}

// parseProjectImport converts Markdown/plain-text import content into previewable structure.
func parseProjectImport(text string) importPreviewResponse {
	preview := importPreviewResponse{
		Sections:            []importPreviewSection{},
		UnsectionedSegments: []importPreviewSegment{},
	}
	rawParagraphs := splitParagraphs(text)
	currentSectionIndex := -1

	for _, para := range rawParagraphs {
		para = strings.TrimSpace(para)
		if para == "" {
			continue
		}
		firstLine := strings.SplitN(para, "\n", 2)[0]
		if strings.HasPrefix(firstLine, "#") {
			title := strings.TrimSpace(strings.TrimLeft(firstLine, "#"))
			if title == "" {
				title = "Untitled Section"
			}
			preview.Sections = append(preview.Sections, importPreviewSection{
				Title:    title,
				Kind:     "chapter",
				Segments: []importPreviewSegment{},
			})
			currentSectionIndex = len(preview.Sections) - 1
			preview.SectionCount++
			continue
		}

		segment := importPreviewSegment{ScriptText: para}
		if currentSectionIndex >= 0 {
			preview.Sections[currentSectionIndex].Segments = append(preview.Sections[currentSectionIndex].Segments, segment)
		} else {
			preview.UnsectionedSegments = append(preview.UnsectionedSegments, segment)
		}
		preview.SegmentCount++
	}

	return preview
}

// splitParagraphs splits text on one or more blank lines.
func splitParagraphs(text string) []string {
	var paragraphs []string
	var current strings.Builder
	lines := strings.Split(strings.ReplaceAll(text, "\r\n", "\n"), "\n")
	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			if current.Len() > 0 {
				paragraphs = append(paragraphs, current.String())
				current.Reset()
			}
		} else {
			if current.Len() > 0 {
				current.WriteByte('\n')
			}
			current.WriteString(line)
		}
	}
	if current.Len() > 0 {
		paragraphs = append(paragraphs, current.String())
	}
	return paragraphs
}

// requireProject validates the path project ID and confirms the project exists.
func (h *ProjectsHandler) requireProject(w http.ResponseWriter, r *http.Request) (int64, bool) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return 0, false
	}
	if _, err := h.Store.GetProject(projectID); err != nil {
		writeStoreError(w, err, "project not found", "failed to get project")
		return 0, false
	}
	return projectID, true
}

// parsePathInt64 reads a positive int64 route value or writes a bad-request response.
func parsePathInt64(w http.ResponseWriter, r *http.Request, name, invalidMessage string) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue(name), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, invalidMessage)
		return 0, false
	}
	return id, true
}

// writeStoreError maps sql.ErrNoRows to 404 and all other store errors to 500.
func writeStoreError(w http.ResponseWriter, err error, notFoundMessage, internalMessage string) {
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, notFoundMessage)
		return
	}
	writeError(w, http.StatusInternalServerError, internalMessage)
}
