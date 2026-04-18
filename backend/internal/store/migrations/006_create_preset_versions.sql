-- Migration 006: Create preset_versions table for tracking edit history
CREATE TABLE IF NOT EXISTS preset_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    voice_name TEXT NOT NULL,
    system_instruction TEXT NOT NULL DEFAULT '',
    sample_text TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT '#6366f1',
    metadata_json TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (preset_id) REFERENCES custom_presets(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_preset_versions_preset_id ON preset_versions(preset_id);
