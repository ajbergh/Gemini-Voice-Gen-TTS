-- 020_export_jobs.sql
-- Export job tracking for deliverable packaging (Plan 11).

CREATE TABLE IF NOT EXISTS export_jobs (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id        INTEGER NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
    export_profile_id INTEGER REFERENCES export_profiles(id) ON DELETE SET NULL,
    status            TEXT    NOT NULL DEFAULT 'pending'
                                CHECK(status IN ('pending','running','complete','failed')),
    output_path       TEXT,
    error             TEXT,
    metadata_json     TEXT,
    created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_project ON export_jobs(project_id);

CREATE TABLE IF NOT EXISTS export_job_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    export_job_id  INTEGER NOT NULL REFERENCES export_jobs(id) ON DELETE CASCADE,
    asset_type     TEXT    NOT NULL,
    asset_id       INTEGER,
    output_name    TEXT    NOT NULL,
    status         TEXT    NOT NULL DEFAULT 'pending'
                      CHECK(status IN ('pending','complete','failed')),
    error          TEXT
);

CREATE INDEX IF NOT EXISTS idx_export_job_items_job ON export_job_items(export_job_id);
