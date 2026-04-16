-- 004_add_preset_tags.sql

CREATE TABLE IF NOT EXISTS preset_tags (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    preset_id INTEGER NOT NULL REFERENCES custom_presets(id) ON DELETE CASCADE,
    tag       TEXT    NOT NULL,
    color     TEXT    NOT NULL DEFAULT '#6366f1',
    UNIQUE(preset_id, tag)
);

CREATE INDEX IF NOT EXISTS idx_preset_tags_preset ON preset_tags(preset_id);
CREATE INDEX IF NOT EXISTS idx_preset_tags_tag    ON preset_tags(tag);
