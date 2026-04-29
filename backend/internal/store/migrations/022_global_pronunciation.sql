-- SPDX-License-Identifier: Apache-2.0
-- Migration 022: global reusable pronunciation dictionaries.

CREATE TABLE IF NOT EXISTS global_pronunciation_dictionaries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL DEFAULT 'Global',
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE TABLE IF NOT EXISTS global_pronunciation_entries (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    dictionary_id INTEGER NOT NULL REFERENCES global_pronunciation_dictionaries(id) ON DELETE CASCADE,
    raw_word      TEXT    NOT NULL,
    replacement   TEXT    NOT NULL,
    is_regex      INTEGER NOT NULL DEFAULT 0 CHECK (is_regex IN (0, 1)),
    enabled       INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    sort_order    INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_global_pronunciation_entries_dict
    ON global_pronunciation_entries(dictionary_id);
