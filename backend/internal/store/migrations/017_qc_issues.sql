-- SPDX-License-Identifier: Apache-2.0
-- Migration 017: QC issues table for review/approval workflow.

CREATE TABLE IF NOT EXISTS qc_issues (
    id                   INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id           INTEGER NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
    section_id           INTEGER REFERENCES script_sections(id) ON DELETE SET NULL,
    segment_id           INTEGER NOT NULL REFERENCES script_segments(id) ON DELETE CASCADE,
    take_id              INTEGER REFERENCES segment_takes(id) ON DELETE SET NULL,
    issue_type           TEXT NOT NULL DEFAULT 'other'
                             CHECK (issue_type IN ('pronunciation','pacing','tone','volume',
                                                   'artifact','missing_pause','wrong_voice',
                                                   'bad_emphasis','other')),
    severity             TEXT NOT NULL DEFAULT 'medium'
                             CHECK (severity IN ('low','medium','high')),
    note                 TEXT NOT NULL DEFAULT '',
    time_offset_seconds  REAL,
    status               TEXT NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open','resolved','wont_fix')),
    created_at           DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
    updated_at           DATETIME NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_qc_issues_project   ON qc_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_qc_issues_segment   ON qc_issues(segment_id);
CREATE INDEX IF NOT EXISTS idx_qc_issues_status    ON qc_issues(project_id, status);
