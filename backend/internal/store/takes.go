// Copyright 2025 ajbergh
// SPDX-License-Identifier: Apache-2.0

// Package store — takes.go implements persistence for segment audio takes and
// reviewer notes.
package store

import (
	"database/sql"
	"fmt"
	"time"
)

// SegmentTake is a single rendered audio take for a script segment.
type SegmentTake struct {
	ID                int64    `json:"id"`
	ProjectID         int64    `json:"project_id"`
	SegmentID         int64    `json:"segment_id"`
	TakeNumber        int      `json:"take_number"`
	VoiceName         *string  `json:"voice_name,omitempty"`
	SpeakerLabel      *string  `json:"speaker_label,omitempty"`
	LanguageCode      *string  `json:"language_code,omitempty"`
	Provider          *string  `json:"provider,omitempty"`
	Model             *string  `json:"model,omitempty"`
	ProviderVoice     *string  `json:"provider_voice,omitempty"`
	AppVoiceName      *string  `json:"app_voice_name,omitempty"`
	PresetID          *int64   `json:"preset_id,omitempty"`
	StyleID           *int64   `json:"style_id,omitempty"`
	AccentID          *string  `json:"accent_id,omitempty"`
	CastProfileID     *int64   `json:"cast_profile_id,omitempty"`
	DictionaryHash    *string  `json:"dictionary_hash,omitempty"`
	PromptHash        *string  `json:"prompt_hash,omitempty"`
	SettingsJSON      *string  `json:"settings_json,omitempty"`
	SystemInstruction *string  `json:"system_instruction,omitempty"`
	ScriptText        string   `json:"script_text"`
	AudioPath         *string  `json:"audio_path,omitempty"`
	DurationSeconds   *float64 `json:"duration_seconds,omitempty"`
	PeakDbfs          *float64 `json:"peak_dbfs,omitempty"`
	RmsDbfs           *float64 `json:"rms_dbfs,omitempty"`
	ClippingDetected  bool     `json:"clipping_detected"`
	SampleRate        *int     `json:"sample_rate,omitempty"`
	Channels          *int     `json:"channels,omitempty"`
	Format            *string  `json:"format,omitempty"`
	ContentHash       string   `json:"content_hash"`
	Status            string   `json:"status"`
	MetadataJSON      *string  `json:"metadata_json,omitempty"`
	CreatedAt         string   `json:"created_at"`
}

// TakeNote is a reviewer comment attached to a segment take.
type TakeNote struct {
	ID        int64  `json:"id"`
	TakeID    int64  `json:"take_id"`
	Note      string `json:"note"`
	CreatedAt string `json:"created_at"`
}

// ListSegmentTakes returns all takes for a segment, newest first.
func (s *Store) ListSegmentTakes(projectID, segmentID int64) ([]SegmentTake, error) {
	rows, err := s.db.Query(
		`SELECT id, project_id, segment_id, take_number, voice_name, speaker_label,
		        language_code, provider, model, system_instruction, script_text,
		        provider_voice, app_voice_name, preset_id, style_id, accent_id,
		        cast_profile_id, dictionary_hash, prompt_hash, settings_json,
		        audio_path, duration_seconds, peak_dbfs, rms_dbfs, clipping_detected,
		        sample_rate, channels, format, content_hash, status, metadata_json, created_at
		   FROM segment_takes
		  WHERE project_id = ? AND segment_id = ?
		  ORDER BY take_number DESC, id DESC`,
		projectID, segmentID,
	)
	if err != nil {
		return nil, fmt.Errorf("query segment takes: %w", err)
	}
	defer rows.Close()

	var takes []SegmentTake
	for rows.Next() {
		take, err := scanSegmentTake(rows)
		if err != nil {
			return nil, err
		}
		takes = append(takes, take)
	}
	return takes, rows.Err()
}

// CreateTake inserts a new segment take and auto-assigns the next take number.
func (s *Store) CreateTake(take SegmentTake) (int64, error) {
	if _, err := s.getProjectSegment(take.ProjectID, take.SegmentID); err != nil {
		return 0, err
	}

	take.Status = defaultString(take.Status, "rendered")
	take.ContentHash = hashScriptText(take.ScriptText)
	now := time.Now().UTC().Format(time.RFC3339)

	// Auto-assign take number as max(existing) + 1 for this segment.
	var maxTake int
	_ = s.db.QueryRow(
		`SELECT COALESCE(MAX(take_number), 0) FROM segment_takes WHERE project_id = ? AND segment_id = ?`,
		take.ProjectID,
		take.SegmentID,
	).Scan(&maxTake)
	take.TakeNumber = maxTake + 1

	result, err := s.db.Exec(
		`INSERT INTO segment_takes (
		     project_id, segment_id, take_number, voice_name, speaker_label,
		     language_code, provider, model, system_instruction, script_text,
		     provider_voice, app_voice_name, preset_id, style_id, accent_id,
		     cast_profile_id, dictionary_hash, prompt_hash, settings_json,
		     audio_path, duration_seconds, peak_dbfs, rms_dbfs, clipping_detected,
		     sample_rate, channels, format, content_hash, status, metadata_json, created_at
		 ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		take.ProjectID,
		take.SegmentID,
		take.TakeNumber,
		take.VoiceName,
		take.SpeakerLabel,
		take.LanguageCode,
		take.Provider,
		take.Model,
		take.SystemInstruction,
		take.ScriptText,
		take.ProviderVoice,
		take.AppVoiceName,
		take.PresetID,
		take.StyleID,
		take.AccentID,
		take.CastProfileID,
		take.DictionaryHash,
		take.PromptHash,
		take.SettingsJSON,
		take.AudioPath,
		take.DurationSeconds,
		take.PeakDbfs,
		take.RmsDbfs,
		boolToInt(take.ClippingDetected),
		take.SampleRate,
		take.Channels,
		take.Format,
		take.ContentHash,
		take.Status,
		take.MetadataJSON,
		now,
	)
	if err != nil {
		return 0, fmt.Errorf("insert segment take: %w", err)
	}
	return result.LastInsertId()
}

// GetTake returns a single take by ID, verified against project.
func (s *Store) GetTake(projectID, takeID int64) (*SegmentTake, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, segment_id, take_number, voice_name, speaker_label,
		        language_code, provider, model, system_instruction, script_text,
		        provider_voice, app_voice_name, preset_id, style_id, accent_id,
		        cast_profile_id, dictionary_hash, prompt_hash, settings_json,
		        audio_path, duration_seconds, peak_dbfs, rms_dbfs, clipping_detected,
		        sample_rate, channels, format, content_hash, status, metadata_json, created_at
		   FROM segment_takes
		  WHERE id = ? AND project_id = ?`,
		takeID, projectID,
	)
	take, err := scanSegmentTake(row)
	if err != nil {
		return nil, fmt.Errorf("query take %d: %w", takeID, err)
	}
	return &take, nil
}

// GetTakeForSegment returns a single take by ID, verified against project and segment.
func (s *Store) GetTakeForSegment(projectID, segmentID, takeID int64) (*SegmentTake, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, segment_id, take_number, voice_name, speaker_label,
		        language_code, provider, model, system_instruction, script_text,
		        provider_voice, app_voice_name, preset_id, style_id, accent_id,
		        cast_profile_id, dictionary_hash, prompt_hash, settings_json,
		        audio_path, duration_seconds, peak_dbfs, rms_dbfs, clipping_detected,
		        sample_rate, channels, format, content_hash, status, metadata_json, created_at
		   FROM segment_takes
		  WHERE id = ? AND project_id = ? AND segment_id = ?`,
		takeID, projectID, segmentID,
	)
	take, err := scanSegmentTake(row)
	if err != nil {
		return nil, fmt.Errorf("query take %d for segment %d: %w", takeID, segmentID, err)
	}
	return &take, nil
}

// DeleteTake removes a segment take by ID.
func (s *Store) DeleteTake(projectID, takeID int64) error {
	result, err := s.db.Exec(
		`DELETE FROM segment_takes WHERE id = ? AND project_id = ?`,
		takeID, projectID,
	)
	if err != nil {
		return fmt.Errorf("delete take %d: %w", takeID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteTakeForSegment removes a segment take by ID, verified against project and segment.
func (s *Store) DeleteTakeForSegment(projectID, segmentID, takeID int64) error {
	result, err := s.db.Exec(
		`DELETE FROM segment_takes WHERE id = ? AND project_id = ? AND segment_id = ?`,
		takeID, projectID, segmentID,
	)
	if err != nil {
		return fmt.Errorf("delete take %d for segment %d: %w", takeID, segmentID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// ListTakeNotes returns notes for a specific take.
func (s *Store) ListTakeNotes(takeID int64) ([]TakeNote, error) {
	rows, err := s.db.Query(
		`SELECT id, take_id, note, created_at FROM take_notes WHERE take_id = ? ORDER BY id ASC`,
		takeID,
	)
	if err != nil {
		return nil, fmt.Errorf("query take notes: %w", err)
	}
	defer rows.Close()

	var notes []TakeNote
	for rows.Next() {
		var n TakeNote
		if err := rows.Scan(&n.ID, &n.TakeID, &n.Note, &n.CreatedAt); err != nil {
			return nil, fmt.Errorf("scan take note: %w", err)
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

// CreateTakeNote adds a reviewer note to a take.
func (s *Store) CreateTakeNote(takeID int64, note string) (int64, error) {
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := s.db.Exec(
		`INSERT INTO take_notes (take_id, note, created_at) VALUES (?, ?, ?)`,
		takeID, note, now,
	)
	if err != nil {
		return 0, fmt.Errorf("insert take note: %w", err)
	}
	return result.LastInsertId()
}

// DeleteTakeNote removes a note by ID.
func (s *Store) DeleteTakeNote(noteID int64) error {
	result, err := s.db.Exec(`DELETE FROM take_notes WHERE id = ?`, noteID)
	if err != nil {
		return fmt.Errorf("delete take note %d: %w", noteID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteTakeNoteForTake removes a note after verifying it belongs to the take.
func (s *Store) DeleteTakeNoteForTake(takeID, noteID int64) error {
	result, err := s.db.Exec(`DELETE FROM take_notes WHERE id = ? AND take_id = ?`, noteID, takeID)
	if err != nil {
		return fmt.Errorf("delete take note %d for take %d: %w", noteID, takeID, err)
	}
	if affected, _ := result.RowsAffected(); affected == 0 {
		return sql.ErrNoRows
	}
	return nil
}

type takesScanner interface {
	Scan(dest ...any) error
}

func scanSegmentTake(scanner takesScanner) (SegmentTake, error) {
	var t SegmentTake
	var clipping int
	if err := scanner.Scan(
		&t.ID,
		&t.ProjectID,
		&t.SegmentID,
		&t.TakeNumber,
		&t.VoiceName,
		&t.SpeakerLabel,
		&t.LanguageCode,
		&t.Provider,
		&t.Model,
		&t.SystemInstruction,
		&t.ScriptText,
		&t.ProviderVoice,
		&t.AppVoiceName,
		&t.PresetID,
		&t.StyleID,
		&t.AccentID,
		&t.CastProfileID,
		&t.DictionaryHash,
		&t.PromptHash,
		&t.SettingsJSON,
		&t.AudioPath,
		&t.DurationSeconds,
		&t.PeakDbfs,
		&t.RmsDbfs,
		&clipping,
		&t.SampleRate,
		&t.Channels,
		&t.Format,
		&t.ContentHash,
		&t.Status,
		&t.MetadataJSON,
		&t.CreatedAt,
	); err != nil {
		return SegmentTake{}, fmt.Errorf("scan segment take: %w", err)
	}
	t.ClippingDetected = clipping != 0
	return t, nil
}

// GetBestTakeForSegment returns the most suitable cached take for a segment.
// Preference order: approved > rendered > any status with audio_path.
// Returns nil, nil if no take with an audio_path exists.
func (s *Store) GetBestTakeForSegment(projectID, segmentID int64) (*SegmentTake, error) {
	row := s.db.QueryRow(
		`SELECT id, project_id, segment_id, take_number, voice_name, speaker_label,
		        language_code, provider, model, system_instruction, script_text,
		        provider_voice, app_voice_name, preset_id, style_id, accent_id,
		        cast_profile_id, dictionary_hash, prompt_hash, settings_json,
		        audio_path, duration_seconds, peak_dbfs, rms_dbfs, clipping_detected,
		        sample_rate, channels, format, content_hash, status, metadata_json, created_at
		   FROM segment_takes
		  WHERE project_id = ? AND segment_id = ? AND audio_path IS NOT NULL
		  ORDER BY
		        CASE status WHEN 'approved' THEN 0 WHEN 'rendered' THEN 1 ELSE 2 END,
		        take_number DESC
		  LIMIT 1`,
		projectID, segmentID,
	)
	take, err := scanSegmentTake(row)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("get best take for segment %d: %w", segmentID, err)
	}
	return &take, nil
}
