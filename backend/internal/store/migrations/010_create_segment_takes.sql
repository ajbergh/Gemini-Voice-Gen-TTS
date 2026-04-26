-- 010_create_segment_takes.sql
-- Stores renderable audio takes per segment plus optional reviewer notes.

CREATE TABLE IF NOT EXISTS segment_takes (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id       INTEGER NOT NULL,
    segment_id       INTEGER NOT NULL,
    take_number      INTEGER NOT NULL DEFAULT 1,
    voice_name       TEXT,
    speaker_label    TEXT,
    language_code    TEXT,
    provider         TEXT,
    model            TEXT,
    system_instruction TEXT,
    script_text      TEXT    NOT NULL DEFAULT '',
    audio_path       TEXT,
    duration_seconds REAL,
    content_hash     TEXT    NOT NULL DEFAULT '',
    status           TEXT    NOT NULL DEFAULT 'rendered',
    metadata_json    TEXT,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES script_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (segment_id) REFERENCES script_segments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_segment_takes_segment ON segment_takes(segment_id, take_number);
CREATE INDEX IF NOT EXISTS idx_segment_takes_project ON segment_takes(project_id);

CREATE TABLE IF NOT EXISTS take_notes (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    take_id    INTEGER NOT NULL,
    note       TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (take_id) REFERENCES segment_takes(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_take_notes_take ON take_notes(take_id);
