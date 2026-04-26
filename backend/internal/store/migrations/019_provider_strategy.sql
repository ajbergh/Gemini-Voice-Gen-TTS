-- 019_provider_strategy.sql
-- Provider/model fallback strategy and cross-provider voice mappings.
-- Column additions are applied idempotently in store.prepareDatabase.

CREATE TABLE IF NOT EXISTS provider_voice_mappings (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id      INTEGER,
    source_provider TEXT    NOT NULL,
    source_voice    TEXT    NOT NULL,
    target_provider TEXT    NOT NULL,
    target_voice    TEXT    NOT NULL,
    notes           TEXT    NOT NULL DEFAULT '',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES script_projects(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_provider_voice_mappings_project
    ON provider_voice_mappings(project_id, source_provider, target_provider);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_voice_mappings_project_unique
    ON provider_voice_mappings(project_id, source_provider, source_voice, target_provider)
    WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_voice_mappings_global_unique
    ON provider_voice_mappings(source_provider, source_voice, target_provider)
    WHERE project_id IS NULL;
