-- 021_script_prep_jobs.sql
-- Stores AI script preparation job results for a project.
-- A prep job parses raw manuscript text into proposed sections,
-- segments, speaker candidates, pronunciation candidates, and style
-- suggestions for creator review before being applied.

CREATE TABLE IF NOT EXISTS script_prep_jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id      INTEGER NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
  raw_script_hash TEXT    NOT NULL,
  raw_script      TEXT    NOT NULL,
  result_json     TEXT,
  status          TEXT    NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'processing', 'complete', 'failed')),
  error           TEXT,
  created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_script_prep_jobs_project ON script_prep_jobs(project_id);
CREATE INDEX IF NOT EXISTS idx_script_prep_jobs_status  ON script_prep_jobs(status);
