-- SPDX-License-Identifier: Apache-2.0
-- Migration 011: pronunciation dictionaries and replacement entries.

CREATE TABLE IF NOT EXISTS pronunciation_dictionaries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES script_projects(id) ON DELETE CASCADE,
    name       TEXT    NOT NULL DEFAULT 'Default',
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_pronunciation_dicts_project
    ON pronunciation_dictionaries(project_id);

CREATE TABLE IF NOT EXISTS pronunciation_entries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    dictionary_id INTEGER NOT NULL REFERENCES pronunciation_dictionaries(id) ON DELETE CASCADE,
    raw_word      TEXT    NOT NULL,
    replacement   TEXT    NOT NULL,
    is_regex      INTEGER NOT NULL DEFAULT 0 CHECK (is_regex IN (0, 1)),
    enabled       INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_pronunciation_entries_dict
    ON pronunciation_entries(dictionary_id);
