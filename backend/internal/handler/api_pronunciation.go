// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package handler — api_pronunciation.go implements HTTP handlers for
// pronunciation dictionaries and replacement entries.
//
// Routes (all under /api/projects/{id}/):
//
//	GET    /api/projects/{id}/dictionaries
//	POST   /api/projects/{id}/dictionaries
//	GET    /api/projects/{id}/dictionaries/{dictId}
//	PUT    /api/projects/{id}/dictionaries/{dictId}
//	DELETE /api/projects/{id}/dictionaries/{dictId}
//	GET    /api/projects/{id}/dictionaries/{dictId}/entries
//	POST   /api/projects/{id}/dictionaries/{dictId}/entries
//	PUT    /api/projects/{id}/dictionaries/{dictId}/entries/{entryId}
//	DELETE /api/projects/{id}/dictionaries/{dictId}/entries/{entryId}
//	POST   /api/projects/{id}/dictionaries/{dictId}/preview
package handler

import (
	"net/http"
	"strings"

	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/pronunciation"
	"github.com/ajbergh/gemini-voice-gen-tts/backend/internal/store"
)

// PronunciationHandler handles pronunciation dictionary and entry endpoints.
type PronunciationHandler struct {
	Store *store.Store
}

// requireProjectAndDict parses {id} and {dictId} path values and verifies
// the dictionary belongs to the project.
func (h *PronunciationHandler) requireProjectAndDict(
	w http.ResponseWriter, r *http.Request,
) (projectID, dictID int64, ok bool) {
	projectID, ok = parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}
	dictID, ok = parsePathInt64(w, r, "dictId", "invalid dictionary ID")
	if !ok {
		return
	}
	// Verify ownership.
	if _, err := h.Store.GetDictionary(projectID, dictID); err != nil {
		writeStoreError(w, err, "dictionary not found", "failed to get dictionary")
		ok = false
		return
	}
	ok = true
	return
}

// requireGlobalDict validates a global dictionary path value before entry operations.
func (h *PronunciationHandler) requireGlobalDict(
	w http.ResponseWriter, r *http.Request,
) (dictID int64, ok bool) {
	dictID, ok = parsePathInt64(w, r, "dictId", "invalid dictionary ID")
	if !ok {
		return 0, false
	}
	if _, err := h.Store.GetGlobalDictionary(dictID); err != nil {
		writeStoreError(w, err, "dictionary not found", "failed to get dictionary")
		return 0, false
	}
	return dictID, true
}

// ---------------------------------------------------------------------------
// Dictionaries
// ---------------------------------------------------------------------------

// ListDictionaries returns all dictionaries for a project.
// GET /api/projects/{id}/dictionaries
func (h *PronunciationHandler) ListDictionaries(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}
	dicts, err := h.Store.ListDictionaries(projectID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list dictionaries")
		return
	}
	if dicts == nil {
		dicts = []store.PronunciationDictionary{}
	}
	writeJSON(w, http.StatusOK, dicts)
}

// CreateDictionary creates a new dictionary for a project.
// POST /api/projects/{id}/dictionaries
func (h *PronunciationHandler) CreateDictionary(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		name = "Dictionary"
	}
	id, err := h.Store.CreateDictionary(projectID, name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create dictionary")
		return
	}
	dict, err := h.Store.GetDictionary(projectID, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read created dictionary")
		return
	}
	writeJSON(w, http.StatusCreated, dict)
}

// GetDictionary returns a single dictionary.
// GET /api/projects/{id}/dictionaries/{dictId}
func (h *PronunciationHandler) GetDictionary(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}
	dictID, ok := parsePathInt64(w, r, "dictId", "invalid dictionary ID")
	if !ok {
		return
	}
	dict, err := h.Store.GetDictionary(projectID, dictID)
	if err != nil {
		writeStoreError(w, err, "dictionary not found", "failed to get dictionary")
		return
	}
	writeJSON(w, http.StatusOK, dict)
}

// UpdateDictionary renames a dictionary.
// PUT /api/projects/{id}/dictionaries/{dictId}
func (h *PronunciationHandler) UpdateDictionary(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}
	dictID, ok := parsePathInt64(w, r, "dictId", "invalid dictionary ID")
	if !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.Store.UpdateDictionary(projectID, dictID, name); err != nil {
		writeStoreError(w, err, "dictionary not found", "failed to update dictionary")
		return
	}
	dict, _ := h.Store.GetDictionary(projectID, dictID)
	writeJSON(w, http.StatusOK, dict)
}

// DeleteDictionary deletes a dictionary and all its entries.
// DELETE /api/projects/{id}/dictionaries/{dictId}
func (h *PronunciationHandler) DeleteDictionary(w http.ResponseWriter, r *http.Request) {
	projectID, ok := parsePathInt64(w, r, "id", "invalid project ID")
	if !ok {
		return
	}
	dictID, ok := parsePathInt64(w, r, "dictId", "invalid dictionary ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteDictionary(projectID, dictID); err != nil {
		writeStoreError(w, err, "dictionary not found", "failed to delete dictionary")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListGlobalDictionaries returns all reusable global dictionaries.
// GET /api/pronunciation/dictionaries
func (h *PronunciationHandler) ListGlobalDictionaries(w http.ResponseWriter, r *http.Request) {
	dicts, err := h.Store.ListGlobalDictionaries()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list dictionaries")
		return
	}
	if dicts == nil {
		dicts = []store.PronunciationDictionary{}
	}
	writeJSON(w, http.StatusOK, dicts)
}

// CreateGlobalDictionary creates a reusable global dictionary.
// POST /api/pronunciation/dictionaries
func (h *PronunciationHandler) CreateGlobalDictionary(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		name = "Dictionary"
	}
	id, err := h.Store.CreateGlobalDictionary(name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create dictionary")
		return
	}
	dict, err := h.Store.GetGlobalDictionary(id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read created dictionary")
		return
	}
	writeJSON(w, http.StatusCreated, dict)
}

// GetGlobalDictionary returns a reusable global dictionary.
// GET /api/pronunciation/dictionaries/{dictId}
func (h *PronunciationHandler) GetGlobalDictionary(w http.ResponseWriter, r *http.Request) {
	dictID, ok := parsePathInt64(w, r, "dictId", "invalid dictionary ID")
	if !ok {
		return
	}
	dict, err := h.Store.GetGlobalDictionary(dictID)
	if err != nil {
		writeStoreError(w, err, "dictionary not found", "failed to get dictionary")
		return
	}
	writeJSON(w, http.StatusOK, dict)
}

// UpdateGlobalDictionary renames a reusable global dictionary.
// PUT /api/pronunciation/dictionaries/{dictId}
func (h *PronunciationHandler) UpdateGlobalDictionary(w http.ResponseWriter, r *http.Request) {
	dictID, ok := parsePathInt64(w, r, "dictId", "invalid dictionary ID")
	if !ok {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	name := strings.TrimSpace(body.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	if err := h.Store.UpdateGlobalDictionary(dictID, name); err != nil {
		writeStoreError(w, err, "dictionary not found", "failed to update dictionary")
		return
	}
	dict, _ := h.Store.GetGlobalDictionary(dictID)
	writeJSON(w, http.StatusOK, dict)
}

// DeleteGlobalDictionary deletes a reusable global dictionary and its entries.
// DELETE /api/pronunciation/dictionaries/{dictId}
func (h *PronunciationHandler) DeleteGlobalDictionary(w http.ResponseWriter, r *http.Request) {
	dictID, ok := parsePathInt64(w, r, "dictId", "invalid dictionary ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteGlobalDictionary(dictID); err != nil {
		writeStoreError(w, err, "dictionary not found", "failed to delete dictionary")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// Entries
// ---------------------------------------------------------------------------

// ListEntries returns all entries in a dictionary.
// GET /api/projects/{id}/dictionaries/{dictId}/entries
func (h *PronunciationHandler) ListEntries(w http.ResponseWriter, r *http.Request) {
	projectID, dictID, ok := h.requireProjectAndDict(w, r)
	if !ok {
		return
	}
	_ = projectID
	entries, err := h.Store.ListEntries(dictID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list entries")
		return
	}
	if entries == nil {
		entries = []store.PronunciationEntry{}
	}
	writeJSON(w, http.StatusOK, entries)
}

// CreateEntry adds a new replacement rule to a dictionary.
// POST /api/projects/{id}/dictionaries/{dictId}/entries
func (h *PronunciationHandler) CreateEntry(w http.ResponseWriter, r *http.Request) {
	projectID, dictID, ok := h.requireProjectAndDict(w, r)
	if !ok {
		return
	}
	_ = projectID
	var req store.PronunciationEntry
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.RawWord = strings.TrimSpace(req.RawWord)
	if req.RawWord == "" {
		writeError(w, http.StatusBadRequest, "raw_word is required")
		return
	}
	req.DictionaryID = dictID
	req.Enabled = true // default to enabled

	id, err := h.Store.CreateEntry(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create entry")
		return
	}
	entry, err := h.Store.GetEntry(dictID, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read created entry")
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

// UpdateEntry replaces a pronunciation entry's fields.
// PUT /api/projects/{id}/dictionaries/{dictId}/entries/{entryId}
func (h *PronunciationHandler) UpdateEntry(w http.ResponseWriter, r *http.Request) {
	projectID, dictID, ok := h.requireProjectAndDict(w, r)
	if !ok {
		return
	}
	_ = projectID
	entryID, ok := parsePathInt64(w, r, "entryId", "invalid entry ID")
	if !ok {
		return
	}
	var req store.PronunciationEntry
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.RawWord = strings.TrimSpace(req.RawWord)
	if req.RawWord == "" {
		writeError(w, http.StatusBadRequest, "raw_word is required")
		return
	}
	req.DictionaryID = dictID
	req.ID = entryID
	if err := h.Store.UpdateEntry(req); err != nil {
		writeStoreError(w, err, "entry not found", "failed to update entry")
		return
	}
	entry, _ := h.Store.GetEntry(dictID, entryID)
	writeJSON(w, http.StatusOK, entry)
}

// DeleteEntry removes a single pronunciation entry.
// DELETE /api/projects/{id}/dictionaries/{dictId}/entries/{entryId}
func (h *PronunciationHandler) DeleteEntry(w http.ResponseWriter, r *http.Request) {
	projectID, dictID, ok := h.requireProjectAndDict(w, r)
	if !ok {
		return
	}
	_ = projectID
	entryID, ok := parsePathInt64(w, r, "entryId", "invalid entry ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteEntry(dictID, entryID); err != nil {
		writeStoreError(w, err, "entry not found", "failed to delete entry")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ListGlobalEntries returns all entries in a reusable global dictionary.
// GET /api/pronunciation/dictionaries/{dictId}/entries
func (h *PronunciationHandler) ListGlobalEntries(w http.ResponseWriter, r *http.Request) {
	dictID, ok := h.requireGlobalDict(w, r)
	if !ok {
		return
	}
	entries, err := h.Store.ListGlobalEntries(dictID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list entries")
		return
	}
	if entries == nil {
		entries = []store.PronunciationEntry{}
	}
	writeJSON(w, http.StatusOK, entries)
}

// CreateGlobalEntry adds a rule to a reusable global dictionary.
// POST /api/pronunciation/dictionaries/{dictId}/entries
func (h *PronunciationHandler) CreateGlobalEntry(w http.ResponseWriter, r *http.Request) {
	dictID, ok := h.requireGlobalDict(w, r)
	if !ok {
		return
	}
	var req store.PronunciationEntry
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.RawWord = strings.TrimSpace(req.RawWord)
	if req.RawWord == "" {
		writeError(w, http.StatusBadRequest, "raw_word is required")
		return
	}
	req.DictionaryID = dictID
	req.Enabled = true

	id, err := h.Store.CreateGlobalEntry(req)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to create entry")
		return
	}
	entry, err := h.Store.GetGlobalEntry(dictID, id)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to read created entry")
		return
	}
	writeJSON(w, http.StatusCreated, entry)
}

// UpdateGlobalEntry replaces a reusable global pronunciation entry.
// PUT /api/pronunciation/dictionaries/{dictId}/entries/{entryId}
func (h *PronunciationHandler) UpdateGlobalEntry(w http.ResponseWriter, r *http.Request) {
	dictID, ok := h.requireGlobalDict(w, r)
	if !ok {
		return
	}
	entryID, ok := parsePathInt64(w, r, "entryId", "invalid entry ID")
	if !ok {
		return
	}
	var req store.PronunciationEntry
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	req.RawWord = strings.TrimSpace(req.RawWord)
	if req.RawWord == "" {
		writeError(w, http.StatusBadRequest, "raw_word is required")
		return
	}
	req.DictionaryID = dictID
	req.ID = entryID
	if err := h.Store.UpdateGlobalEntry(req); err != nil {
		writeStoreError(w, err, "entry not found", "failed to update entry")
		return
	}
	entry, _ := h.Store.GetGlobalEntry(dictID, entryID)
	writeJSON(w, http.StatusOK, entry)
}

// DeleteGlobalEntry removes a reusable global pronunciation entry.
// DELETE /api/pronunciation/dictionaries/{dictId}/entries/{entryId}
func (h *PronunciationHandler) DeleteGlobalEntry(w http.ResponseWriter, r *http.Request) {
	dictID, ok := h.requireGlobalDict(w, r)
	if !ok {
		return
	}
	entryID, ok := parsePathInt64(w, r, "entryId", "invalid entry ID")
	if !ok {
		return
	}
	if err := h.Store.DeleteGlobalEntry(dictID, entryID); err != nil {
		writeStoreError(w, err, "entry not found", "failed to delete entry")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------

// previewRequest is the request body for the preview endpoint.
type previewRequest struct {
	Text string `json:"text"`
}

// previewResponse is the response body from the preview endpoint.
type previewResponse struct {
	Original string `json:"original"`
	Result   string `json:"result"`
	Changed  int    `json:"changed"`
}

// PreviewDictionary applies a dictionary to sample text and returns the result.
// POST /api/projects/{id}/dictionaries/{dictId}/preview
func (h *PronunciationHandler) PreviewDictionary(w http.ResponseWriter, r *http.Request) {
	projectID, dictID, ok := h.requireProjectAndDict(w, r)
	if !ok {
		return
	}
	_ = projectID
	var req previewRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		writeError(w, http.StatusBadRequest, "text is required")
		return
	}
	entries, err := h.Store.ListEntries(dictID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list entries")
		return
	}
	result, changed := pronunciation.Preview(req.Text, entries)
	writeJSON(w, http.StatusOK, previewResponse{
		Original: req.Text,
		Result:   result,
		Changed:  changed,
	})
}

// PreviewGlobalDictionary applies a reusable global dictionary to sample text.
// POST /api/pronunciation/dictionaries/{dictId}/preview
func (h *PronunciationHandler) PreviewGlobalDictionary(w http.ResponseWriter, r *http.Request) {
	dictID, ok := h.requireGlobalDict(w, r)
	if !ok {
		return
	}
	var req previewRequest
	if err := decodeJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}
	if strings.TrimSpace(req.Text) == "" {
		writeError(w, http.StatusBadRequest, "text is required")
		return
	}
	entries, err := h.Store.ListGlobalEntries(dictID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "failed to list entries")
		return
	}
	result, changed := pronunciation.Preview(req.Text, entries)
	writeJSON(w, http.StatusOK, previewResponse{
		Original: req.Text,
		Result:   result,
		Changed:  changed,
	})
}
