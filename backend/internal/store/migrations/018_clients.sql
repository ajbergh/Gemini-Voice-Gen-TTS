-- 018_clients.sql
-- Client and brand voiceover workspaces.

CREATE TABLE IF NOT EXISTS clients (
    id                        INTEGER PRIMARY KEY AUTOINCREMENT,
    name                      TEXT    NOT NULL,
    description               TEXT    NOT NULL DEFAULT '',
    brand_notes               TEXT    NOT NULL DEFAULT '',
    default_provider          TEXT,
    default_model             TEXT,
    default_voice_name        TEXT,
    default_preset_id         INTEGER REFERENCES custom_presets(id) ON DELETE SET NULL,
    default_style_id          INTEGER REFERENCES performance_styles(id) ON DELETE SET NULL,
    default_export_profile_id INTEGER REFERENCES export_profiles(id) ON DELETE SET NULL,
    metadata_json             TEXT,
    created_at                TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at                TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS client_assets (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id  INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
    asset_type TEXT    NOT NULL CHECK(asset_type IN ('preset','style','dictionary','project','export_profile')),
    asset_id   INTEGER NOT NULL,
    label      TEXT    NOT NULL DEFAULT '',
    created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE(client_id, asset_type, asset_id)
);

CREATE INDEX IF NOT EXISTS idx_clients_name         ON clients(name);
CREATE INDEX IF NOT EXISTS idx_client_assets_client ON client_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_client_assets_type   ON client_assets(client_id, asset_type);
