-- 013_export_profiles.sql
-- Stores named finishing/export profiles used for silence trim, normalization,
-- and silence padding between segments.

CREATE TABLE IF NOT EXISTS export_profiles (
    id                    INTEGER PRIMARY KEY AUTOINCREMENT,
    name                  TEXT    NOT NULL,
    target_kind           TEXT    NOT NULL DEFAULT 'audiobook',
    trim_silence          INTEGER NOT NULL DEFAULT 1,
    silence_threshold_db  REAL    NOT NULL DEFAULT -50.0,
    leading_silence_ms    INTEGER NOT NULL DEFAULT 0,
    trailing_silence_ms   INTEGER NOT NULL DEFAULT 0,
    inter_segment_silence_ms INTEGER NOT NULL DEFAULT 500,
    normalize_peak_db     REAL    NOT NULL DEFAULT -3.0,
    is_builtin            INTEGER NOT NULL DEFAULT 0,
    metadata_json         TEXT,
    created_at            TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at            TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Seed default profiles.
INSERT OR IGNORE INTO export_profiles
    (id, name, target_kind, trim_silence, silence_threshold_db,
     leading_silence_ms, trailing_silence_ms, inter_segment_silence_ms,
     normalize_peak_db, is_builtin)
VALUES
    (1, 'Audiobook',       'audiobook',   1, -50.0,  0,   0,  500,  -3.0, 1),
    (2, 'Podcast',         'podcast',     1, -45.0,  0,   0, 1000,  -3.0, 1),
    (3, 'Broadcast',       'broadcast',   1, -40.0,  0,   0,  250,  -1.0, 1),
    (4, 'Web Video VO',    'web_video',   1, -50.0,  0,   0,  300,  -3.0, 1),
    (5, 'Raw (No Process)','raw',         0, -60.0,  0,   0,    0,   0.0, 1);
