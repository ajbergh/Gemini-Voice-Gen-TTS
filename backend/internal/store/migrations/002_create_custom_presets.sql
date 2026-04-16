-- 002_create_custom_presets.sql

CREATE TABLE IF NOT EXISTS custom_presets (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    name               TEXT    NOT NULL UNIQUE,
    voice_name         TEXT    NOT NULL,
    system_instruction TEXT,
    sample_text        TEXT,
    audio_path         TEXT,
    source_query       TEXT,
    metadata_json      TEXT,
    created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_custom_presets_voice ON custom_presets(voice_name);
CREATE INDEX IF NOT EXISTS idx_custom_presets_name  ON custom_presets(name);
