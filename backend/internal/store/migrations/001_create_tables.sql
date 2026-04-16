-- 001_create_tables.sql

CREATE TABLE IF NOT EXISTS api_keys (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    provider   TEXT    NOT NULL UNIQUE,
    encrypted  BLOB    NOT NULL,
    nonce      BLOB    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS config (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT    NOT NULL,  -- 'recommendation' or 'tts'
    voice_name TEXT,
    input_text TEXT    NOT NULL,  -- user prompt or script text
    result_json TEXT,             -- JSON blob: AI result, voice list, etc.
    audio_path TEXT,              -- local file path to cached audio (nullable)
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS voices (
    name             TEXT PRIMARY KEY,
    pitch            TEXT NOT NULL,
    gender           TEXT NOT NULL,
    characteristics  TEXT NOT NULL,       -- JSON array
    audio_sample_url TEXT NOT NULL,
    file_uri         TEXT NOT NULL,
    analysis_json    TEXT NOT NULL,       -- full analysis object as JSON
    image_url        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_history_type       ON history(type);
CREATE INDEX IF NOT EXISTS idx_history_created_at ON history(created_at);
CREATE INDEX IF NOT EXISTS idx_history_voice_name ON history(voice_name);
