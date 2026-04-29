-- 014_cast_profiles.sql
-- Project-scoped cast bible profiles and version snapshots.

CREATE TABLE IF NOT EXISTS cast_profiles (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id          INTEGER NOT NULL,
    series_id           INTEGER,
    name                TEXT    NOT NULL,
    role                TEXT    NOT NULL DEFAULT 'supporting',
    description         TEXT    NOT NULL DEFAULT '',
    voice_name          TEXT,
    preset_id           INTEGER,
    style_id            INTEGER,
    accent_id           TEXT,
    language_code       TEXT,
    age_impression      TEXT,
    emotional_range     TEXT,
    sample_lines_json   TEXT,
    pronunciation_notes TEXT,
    metadata_json       TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES script_projects(id) ON DELETE CASCADE,
    FOREIGN KEY (preset_id) REFERENCES custom_presets(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_cast_profiles_project ON cast_profiles(project_id, role, sort_order, id);
CREATE INDEX IF NOT EXISTS idx_cast_profiles_voice ON cast_profiles(voice_name);

CREATE TABLE IF NOT EXISTS cast_profile_versions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_id          INTEGER NOT NULL,
    name                TEXT    NOT NULL,
    role                TEXT    NOT NULL,
    description         TEXT    NOT NULL DEFAULT '',
    voice_name          TEXT,
    preset_id           INTEGER,
    style_id            INTEGER,
    accent_id           TEXT,
    language_code       TEXT,
    age_impression      TEXT,
    emotional_range     TEXT,
    sample_lines_json   TEXT,
    pronunciation_notes TEXT,
    metadata_json       TEXT,
    sort_order          INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (profile_id) REFERENCES cast_profiles(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cast_profile_versions_profile ON cast_profile_versions(profile_id, created_at DESC);
