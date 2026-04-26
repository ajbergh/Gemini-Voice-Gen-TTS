// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — projects.go implements durable script project persistence.
package store

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"
)

// ScriptProject is a durable narration or voiceover project.
type ScriptProject struct {
	ID                  int64   `json:"id"`
	Title               string  `json:"title"`
	Kind                string  `json:"kind"`
	Description         string  `json:"description"`
	Status              string  `json:"status"`
	DefaultVoiceName    *string `json:"default_voice_name,omitempty"`
	DefaultPresetID     *int64  `json:"default_preset_id,omitempty"`
	DefaultStyleID      *int64  `json:"default_style_id,omitempty"`
	DefaultAccentID     *string `json:"default_accent_id,omitempty"`
	DefaultLanguageCode *string `json:"default_language_code,omitempty"`
	DefaultProvider     *string `json:"default_provider,omitempty"`
	DefaultModel        *string `json:"default_model,omitempty"`
	FallbackProvider    *string `json:"fallback_provider,omitempty"`
	FallbackModel       *string `json:"fallback_model,omitempty"`
	ClientID            *int64  `json:"client_id,omitempty"`
	MetadataJSON        *string `json:"metadata_json,omitempty"`
	CreatedAt           string  `json:"created_at"`
	UpdatedAt           string  `json:"updated_at"`
}

// ScriptSection groups project content into chapters, scenes, or folders.
type ScriptSection struct {
	ID           int64   `json:"id"`
	ProjectID    int64   `json:"project_id"`
	ParentID     *int64  `json:"parent_id,omitempty"`
	Kind         string  `json:"kind"`
	Title        string  `json:"title"`
	SortOrder    int     `json:"sort_order"`
	MetadataJSON *string `json:"metadata_json,omitempty"`
	CreatedAt    string  `json:"created_at"`
	UpdatedAt    string  `json:"updated_at"`
}

// ScriptSegment is a renderable script unit.
type ScriptSegment struct {
	ID               int64   `json:"id"`
	ProjectID        int64   `json:"project_id"`
	SectionID        *int64  `json:"section_id,omitempty"`
	Title            string  `json:"title"`
	ScriptText       string  `json:"script_text"`
	SpeakerLabel     *string `json:"speaker_label,omitempty"`
	VoiceName        *string `json:"voice_name,omitempty"`
	CastProfileID    *int64  `json:"cast_profile_id,omitempty"`
	PresetID         *int64  `json:"preset_id,omitempty"`
	StyleID          *int64  `json:"style_id,omitempty"`
	AccentID         *string `json:"accent_id,omitempty"`
	LanguageCode     *string `json:"language_code,omitempty"`
	Provider         *string `json:"provider,omitempty"`
	Model            *string `json:"model,omitempty"`
	FallbackProvider *string `json:"fallback_provider,omitempty"`
	FallbackModel    *string `json:"fallback_model,omitempty"`
	Status           string  `json:"status"`
	ContentHash      string  `json:"content_hash"`
	SortOrder        int     `json:"sort_order"`
	MetadataJSON     *string `json:"metadata_json,omitempty"`
	CreatedAt        string  `json:"created_at"`
	UpdatedAt        string  `json:"updated_at"`
}

// ListProjects returns all non-deleted script projects, newest first.
func (s *Store) ListProjects() ([]ScriptProject, error) {
	rows, err := s.db.Query(
		`SELECT id, title, kind, description, status, default_voice_name, default_preset_id,
		        default_style_id, default_accent_id, default_language_code, default_provider,
		        default_model, fallback_provider, fallback_model, client_id, metadata_json,
		        created_at, updated_at
		   FROM script_projects
		  ORDER BY updated_at DESC, id DESC`,
	)
	if err != nil {
		return nil, fmt.Errorf("query script projects: %w", err)
	}
	defer rows.Close()

	var projects []ScriptProject
	for rows.Next() {
		project, err := scanScriptProject(rows)
		if err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	return projects, rows.Err()
}

// CreateProject creates a new script project.
func (s *Store) CreateProject(project ScriptProject) (int64, error) {
	project.Kind = defaultString(project.Kind, "audiobook")
	project.Status = defaultString(project.Status, "draft")
	now := time.Now().UTC().Format(time.RFC3339)

	result, err := s.db.Exec(
		`INSERT INTO script_projects (
		     title, kind, description, status, default_voice_name, default_preset_id,
		     default_style_id, default_accent_id, default_language_code, default_provider,
		     default_model, fallback_provider, fallback_model, client_id, metadata_json,
		     created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		strings.TrimSpace(project.Title),
		project.Kind,
		project.Description,
		project.Status,
		project.DefaultVoiceName,
		project.DefaultPresetID,
		project.DefaultStyleID,
		project.DefaultAccentID,
		project.DefaultLanguageCode,
		project.DefaultProvider,
		project.DefaultModel,
		project.FallbackProvider,
		project.FallbackModel,
		project.ClientID,
		project.MetadataJSON,
		now,
		now,
	)
	if err != nil {
		return 0, fmt.Errorf("insert script project: %w", err)
	}
	return result.LastInsertId()
}

// GetProject returns a single script project by ID.
func (s *Store) GetProject(id int64) (*ScriptProject, error) {
	row := s.db.QueryRow(
		`SELECT id, title, kind, description, status, default_voice_name, default_preset_id,
		        default_style_id, default_accent_id, default_language_code, default_provider,
		        default_model, fallback_provider, fallback_model, client_id, metadata_json,
		        created_at, updated_at
		   FROM script_projects
		  WHERE id = ?`,
		id,
	)
	project, err := scanScriptProject(row)
	if err != nil {
		return nil, fmt.Errorf("query script project %d: %w", id, err)
	}
	return &project, nil
}

// UpdateProject replaces mutable project fields.
func (s *Store) UpdateProject(id int64, project ScriptProject) error {
	project.Kind = defaultString(project.Kind, "audiobook")
	project.Status = defaultString(project.Status, "draft")
	now := time.Now().UTC().Format(time.RFC3339)

	result, err := s.db.Exec(
		`UPDATE script_projects
		    SET title = ?, kind = ?, description = ?, status = ?, default_voice_name = ?,
		        default_preset_id = ?, default_style_id = ?, default_accent_id = ?,
		        default_language_code = ?, default_provider = ?, default_model = ?,
		        fallback_provider = ?, fallback_model = ?, client_id = ?,
		        metadata_json = ?, updated_at = ?
		  WHERE id = ?`,
		strings.TrimSpace(project.Title),
		project.Kind,
		project.Description,
		project.Status,
		project.DefaultVoiceName,
		project.DefaultPresetID,
		project.DefaultStyleID,
		project.DefaultAccentID,
		project.DefaultLanguageCode,
		project.DefaultProvider,
		project.DefaultModel,
		project.FallbackProvider,
		project.FallbackModel,
		project.ClientID,
		project.MetadataJSON,
		now,
		id,
	)
	if err != nil {
		return fmt.Errorf("update script project %d: %w", id, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ArchiveProject marks a project archived.
func (s *Store) ArchiveProject(id int64) error {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec("UPDATE script_projects SET status = 'archived', updated_at = ? WHERE id = ?", now, id)
	if err != nil {
		return fmt.Errorf("archive script project %d: %w", id, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ListProjectSections returns sections for a project in sort order.
func (s *Store) ListProjectSections(projectID int64) ([]ScriptSection, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, parent_id, kind, title, sort_order, metadata_json, created_at, updated_at
		   FROM script_sections
		  WHERE project_id = ?
		  ORDER BY sort_order ASC, id ASC`,
		projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("query script sections: %w", err)
	}
	defer rows.Close()

	var sections []ScriptSection
	for rows.Next() {
		section, err := scanScriptSection(rows)
		if err != nil {
			return nil, err
		}
		sections = append(sections, section)
	}
	return sections, rows.Err()
}

// CreateSection creates a project section.
func (s *Store) CreateSection(section ScriptSection) (int64, error) {
	section.Kind = defaultString(section.Kind, "chapter")
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`INSERT INTO script_sections (project_id, parent_id, kind, title, sort_order, metadata_json, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		section.ProjectID,
		section.ParentID,
		section.Kind,
		strings.TrimSpace(section.Title),
		section.SortOrder,
		section.MetadataJSON,
		now,
		now,
	)
	if err != nil {
		return 0, fmt.Errorf("insert script section: %w", err)
	}
	return result.LastInsertId()
}

// UpdateSection replaces mutable section fields.
func (s *Store) UpdateSection(projectID, sectionID int64, section ScriptSection) error {
	section.Kind = defaultString(section.Kind, "chapter")
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`UPDATE script_sections
		    SET parent_id = ?, kind = ?, title = ?, sort_order = ?, metadata_json = ?, updated_at = ?
		  WHERE id = ? AND project_id = ?`,
		section.ParentID,
		section.Kind,
		strings.TrimSpace(section.Title),
		section.SortOrder,
		section.MetadataJSON,
		now,
		sectionID,
		projectID,
	)
	if err != nil {
		return fmt.Errorf("update script section %d: %w", sectionID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteSection removes a section and leaves its segments unsectioned.
func (s *Store) DeleteSection(projectID, sectionID int64) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("begin delete section tx: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.Exec("UPDATE script_segments SET section_id = NULL, updated_at = ? WHERE project_id = ? AND section_id = ?", time.Now().UTC().Format(time.RFC3339), projectID, sectionID); err != nil {
		return fmt.Errorf("unassign section segments: %w", err)
	}
	result, err := tx.Exec("DELETE FROM script_sections WHERE id = ? AND project_id = ?", sectionID, projectID)
	if err != nil {
		return fmt.Errorf("delete script section %d: %w", sectionID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return tx.Commit()
}

// ListProjectSegments returns project segments in section/sort order.
func (s *Store) ListProjectSegments(projectID int64) ([]ScriptSegment, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, section_id, title, script_text, speaker_label, voice_name,
		        cast_profile_id, preset_id, style_id, accent_id, language_code, provider, model,
		        fallback_provider, fallback_model, status,
		        content_hash, sort_order, metadata_json, created_at, updated_at
		   FROM script_segments
		  WHERE project_id = ?
		  ORDER BY COALESCE(section_id, 0) ASC, sort_order ASC, id ASC`,
		projectID,
	)
	if err != nil {
		return nil, fmt.Errorf("query script segments: %w", err)
	}
	defer rows.Close()

	var segments []ScriptSegment
	for rows.Next() {
		segment, err := scanScriptSegment(rows)
		if err != nil {
			return nil, err
		}
		segments = append(segments, segment)
	}
	return segments, rows.Err()
}

// CreateSegment creates a renderable segment.
func (s *Store) CreateSegment(segment ScriptSegment) (int64, error) {
	segment.Status = defaultString(segment.Status, "draft")
	segment.ContentHash = hashScriptText(segment.ScriptText)
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`INSERT INTO script_segments (
		     project_id, section_id, title, script_text, speaker_label, voice_name,
		     cast_profile_id, preset_id, style_id, accent_id, language_code, provider, model,
		     fallback_provider, fallback_model, status,
		     content_hash, sort_order, metadata_json, created_at, updated_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		segment.ProjectID,
		segment.SectionID,
		strings.TrimSpace(segment.Title),
		segment.ScriptText,
		segment.SpeakerLabel,
		segment.VoiceName,
		segment.CastProfileID,
		segment.PresetID,
		segment.StyleID,
		segment.AccentID,
		segment.LanguageCode,
		segment.Provider,
		segment.Model,
		segment.FallbackProvider,
		segment.FallbackModel,
		segment.Status,
		segment.ContentHash,
		segment.SortOrder,
		segment.MetadataJSON,
		now,
		now,
	)
	if err != nil {
		return 0, fmt.Errorf("insert script segment: %w", err)
	}
	return result.LastInsertId()
}

// UpdateSegment replaces mutable segment fields and marks rendered text dirty when needed.
func (s *Store) UpdateSegment(projectID, segmentID int64, segment ScriptSegment) error {
	existing, err := s.getProjectSegment(projectID, segmentID)
	if err != nil {
		return err
	}
	segment.Status = defaultString(segment.Status, existing.Status)
	nextHash := hashScriptText(segment.ScriptText)
	if nextHash != existing.ContentHash && segment.Status == existing.Status && isRenderedLikeStatus(existing.Status) {
		segment.Status = "changed"
	}

	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`UPDATE script_segments
		    SET section_id = ?, title = ?, script_text = ?, speaker_label = ?, voice_name = ?,
		        cast_profile_id = ?, preset_id = ?, style_id = ?, accent_id = ?, language_code = ?,
		        provider = ?, model = ?, fallback_provider = ?, fallback_model = ?,
		        status = ?, content_hash = ?, sort_order = ?,
		        metadata_json = ?, updated_at = ?
		  WHERE id = ? AND project_id = ?`,
		segment.SectionID,
		strings.TrimSpace(segment.Title),
		segment.ScriptText,
		segment.SpeakerLabel,
		segment.VoiceName,
		segment.CastProfileID,
		segment.PresetID,
		segment.StyleID,
		segment.AccentID,
		segment.LanguageCode,
		segment.Provider,
		segment.Model,
		segment.FallbackProvider,
		segment.FallbackModel,
		segment.Status,
		nextHash,
		segment.SortOrder,
		segment.MetadataJSON,
		now,
		segmentID,
		projectID,
	)
	if err != nil {
		return fmt.Errorf("update script segment %d: %w", segmentID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteSegment removes a project segment.
func (s *Store) DeleteSegment(projectID, segmentID int64) error {
	result, err := s.db.Exec("DELETE FROM script_segments WHERE id = ? AND project_id = ?", segmentID, projectID)
	if err != nil {
		return fmt.Errorf("delete script segment %d: %w", segmentID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// UpdateSegmentStatus updates only the status field of a single segment.
func (s *Store) UpdateSegmentStatus(projectID, segmentID int64, status string) error {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`UPDATE script_segments SET status = ?, updated_at = ? WHERE id = ? AND project_id = ?`,
		status, now, segmentID, projectID,
	)
	if err != nil {
		return fmt.Errorf("update segment status %d: %w", segmentID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetProjectSegment returns a single segment, verified against its project.
func (s *Store) GetProjectSegment(projectID, segmentID int64) (*ScriptSegment, error) {
	return s.getProjectSegment(projectID, segmentID)
}

func (s *Store) getProjectSegment(projectID, segmentID int64) (*ScriptSegment, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, section_id, title, script_text, speaker_label, voice_name,
		        cast_profile_id, preset_id, style_id, accent_id, language_code, provider, model,
		        fallback_provider, fallback_model, status,
		        content_hash, sort_order, metadata_json, created_at, updated_at
		   FROM script_segments
		  WHERE id = ? AND project_id = ?`,
		segmentID,
		projectID,
	)
	segment, err := scanScriptSegment(row)
	if err != nil {
		return nil, fmt.Errorf("query script segment %d: %w", segmentID, err)
	}
	return &segment, nil
}

type scriptScanner interface {
	Scan(dest ...any) error
}

func scanScriptProject(scanner scriptScanner) (ScriptProject, error) {
	var project ScriptProject
	if err := scanner.Scan(
		&project.ID,
		&project.Title,
		&project.Kind,
		&project.Description,
		&project.Status,
		&project.DefaultVoiceName,
		&project.DefaultPresetID,
		&project.DefaultStyleID,
		&project.DefaultAccentID,
		&project.DefaultLanguageCode,
		&project.DefaultProvider,
		&project.DefaultModel,
		&project.FallbackProvider,
		&project.FallbackModel,
		&project.ClientID,
		&project.MetadataJSON,
		&project.CreatedAt,
		&project.UpdatedAt,
	); err != nil {
		return ScriptProject{}, fmt.Errorf("scan script project: %w", err)
	}
	return project, nil
}

func scanScriptSection(scanner scriptScanner) (ScriptSection, error) {
	var section ScriptSection
	if err := scanner.Scan(
		&section.ID,
		&section.ProjectID,
		&section.ParentID,
		&section.Kind,
		&section.Title,
		&section.SortOrder,
		&section.MetadataJSON,
		&section.CreatedAt,
		&section.UpdatedAt,
	); err != nil {
		return ScriptSection{}, fmt.Errorf("scan script section: %w", err)
	}
	return section, nil
}

func scanScriptSegment(scanner scriptScanner) (ScriptSegment, error) {
	var segment ScriptSegment
	if err := scanner.Scan(
		&segment.ID,
		&segment.ProjectID,
		&segment.SectionID,
		&segment.Title,
		&segment.ScriptText,
		&segment.SpeakerLabel,
		&segment.VoiceName,
		&segment.CastProfileID,
		&segment.PresetID,
		&segment.StyleID,
		&segment.AccentID,
		&segment.LanguageCode,
		&segment.Provider,
		&segment.Model,
		&segment.FallbackProvider,
		&segment.FallbackModel,
		&segment.Status,
		&segment.ContentHash,
		&segment.SortOrder,
		&segment.MetadataJSON,
		&segment.CreatedAt,
		&segment.UpdatedAt,
	); err != nil {
		return ScriptSegment{}, fmt.Errorf("scan script segment: %w", err)
	}
	return segment, nil
}

func defaultString(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

func hashScriptText(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func isRenderedLikeStatus(status string) bool {
	switch strings.ToLower(status) {
	case "rendered", "approved", "locked":
		return true
	default:
		return false
	}
}

var _ scriptScanner = (*sql.Row)(nil)
