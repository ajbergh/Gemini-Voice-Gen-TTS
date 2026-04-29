-- 009_create_script_projects.sql
-- Minimal durable project/section/segment foundation for narration workflows.

CREATE TABLE IF NOT EXISTS script_projects (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    title                 TEXT    NOT NULL,
    kind                  TEXT    NOT NULL DEFAULT 'audiobook',
    description           TEXT    NOT NULL DEFAULT '',
    status                TEXT    NOT NULL DEFAULT 'draft',
    default_voice_name    TEXT,
    default_preset_id     INTEGER,
    default_style_id      INTEGER,
    default_accent_id     TEXT,
    default_language_code TEXT,
    default_provider      TEXT,
    default_model         TEXT,
    metadata_json         TEXT,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS script_sections (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL,
    parent_id     INTEGER,
    kind          TEXT    NOT NULL DEFAULT 'chapter',
    title         TEXT    NOT NULL,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES script_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES script_sections(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS script_segments (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id    INTEGER NOT NULL,
    section_id    INTEGER,
    title         TEXT    NOT NULL DEFAULT '',
    script_text   TEXT    NOT NULL DEFAULT '',
    speaker_label TEXT,
    voice_name    TEXT,
    preset_id     INTEGER,
    style_id      INTEGER,
    accent_id     TEXT,
    language_code TEXT,
    provider      TEXT,
    model         TEXT,
    status        TEXT    NOT NULL DEFAULT 'draft',
    content_hash  TEXT    NOT NULL DEFAULT '',
    sort_order    INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES script_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (section_id) REFERENCES script_sections(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_script_projects_status ON script_projects(status);
CREATE INDEX IF NOT EXISTS idx_script_projects_updated_at ON script_projects(updated_at);
CREATE INDEX IF NOT EXISTS idx_script_sections_project_id ON script_sections(project_id);
CREATE INDEX IF NOT EXISTS idx_script_sections_parent_id ON script_sections(parent_id);
CREATE INDEX IF NOT EXISTS idx_script_segments_project_id ON script_segments(project_id);
CREATE INDEX IF NOT EXISTS idx_script_segments_section_id ON script_segments(section_id);
CREATE INDEX IF NOT EXISTS idx_script_segments_status ON script_segments(status);

