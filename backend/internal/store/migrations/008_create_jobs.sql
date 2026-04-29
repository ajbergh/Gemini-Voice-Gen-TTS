-- 008_create_jobs.sql
-- Persists long-running and async job state for progress reconciliation.

CREATE TABLE IF NOT EXISTS jobs (
    id              TEXT PRIMARY KEY,
    job_type        TEXT    NOT NULL,
    status          TEXT    NOT NULL,
    project_id      TEXT,
    section_id      TEXT,
    segment_id      TEXT,
    total_items     INTEGER NOT NULL DEFAULT 0,
    completed_items INTEGER NOT NULL DEFAULT 0,
    failed_items    INTEGER NOT NULL DEFAULT 0,
    percent         INTEGER NOT NULL DEFAULT 0,
    message         TEXT,
    error           TEXT,
    error_code      TEXT,
    metadata_json   TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    completed_at    TEXT
);

CREATE TABLE IF NOT EXISTS job_items (
    id            TEXT PRIMARY KEY,
    job_id        TEXT    NOT NULL,
    segment_id    TEXT,
    status        TEXT    NOT NULL,
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error    TEXT,
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_updated_at ON jobs(updated_at);
CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_job_items_job_id ON job_items(job_id);
CREATE INDEX IF NOT EXISTS idx_job_items_segment_id ON job_items(segment_id);

