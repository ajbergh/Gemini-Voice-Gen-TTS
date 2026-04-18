-- 007_create_api_key_pool.sql
-- Supports multiple API keys per provider for round-robin / failover rotation.

CREATE TABLE IF NOT EXISTS api_key_pool (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    provider    TEXT    NOT NULL,
    label       TEXT    NOT NULL DEFAULT '',
    encrypted   BLOB    NOT NULL,
    nonce       BLOB    NOT NULL,
    is_active   INTEGER NOT NULL DEFAULT 1,
    error_count INTEGER NOT NULL DEFAULT 0,
    last_used_at TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_key_pool_provider ON api_key_pool(provider);
