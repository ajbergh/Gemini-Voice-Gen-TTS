-- 003_create_favorites.sql

CREATE TABLE IF NOT EXISTS favorites (
    voice_name TEXT PRIMARY KEY,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
