-- 016_performance_styles.sql
-- Reusable performance style presets with version snapshots and 8 built-in seed styles.

CREATE TABLE IF NOT EXISTS performance_styles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    scope           TEXT    NOT NULL DEFAULT 'global',  -- 'global' | 'project'
    project_id      INTEGER REFERENCES script_projects(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    description     TEXT    NOT NULL DEFAULT '',
    category        TEXT    NOT NULL DEFAULT 'custom',
    pacing          TEXT,           -- 'slow' | 'measured' | 'conversational' | 'brisk' | 'rapid'
    energy          TEXT,           -- 'low' | 'subdued' | 'moderate' | 'elevated' | 'high'
    emotion         TEXT,           -- 'neutral' | 'warm' | 'intense' | 'playful' | 'mysterious' etc.
    articulation    TEXT,           -- 'casual' | 'clear' | 'precise' | 'highly_articulated'
    pause_density   TEXT,           -- 'minimal' | 'natural' | 'generous' | 'dramatic'
    director_notes  TEXT    NOT NULL DEFAULT '',
    audio_tags_json TEXT,           -- JSON array of audio tag hint strings
    is_builtin      INTEGER NOT NULL DEFAULT 0,
    sort_order      INTEGER NOT NULL DEFAULT 0,
    metadata_json   TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS performance_style_versions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    style_id        INTEGER NOT NULL REFERENCES performance_styles(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    description     TEXT    NOT NULL DEFAULT '',
    category        TEXT    NOT NULL DEFAULT 'custom',
    pacing          TEXT,
    energy          TEXT,
    emotion         TEXT,
    articulation    TEXT,
    pause_density   TEXT,
    director_notes  TEXT    NOT NULL DEFAULT '',
    audio_tags_json TEXT,
    metadata_json   TEXT,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_performance_styles_scope
    ON performance_styles(scope, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_performance_styles_project
    ON performance_styles(project_id, sort_order, id)
    WHERE project_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_performance_style_versions_style
    ON performance_style_versions(style_id, created_at DESC, id DESC);

-- 8 built-in global styles.
INSERT OR IGNORE INTO performance_styles
    (id, scope, name, description, category, pacing, energy, emotion,
     articulation, pause_density, director_notes, is_builtin, sort_order)
VALUES
    (1, 'global', 'Calm Narration',
     'Steady, authoritative, clear audiobook narration.',
     'narration', 'measured', 'subdued', 'warm', 'clear', 'natural',
     'Maintain consistent pacing. Slight downward inflection at sentence ends. Warm but not overly familiar.',
     1, 10),

    (2, 'global', 'Suspense',
     'Tense, deliberate delivery with strategic pauses.',
     'narration', 'slow', 'moderate', 'intense', 'precise', 'dramatic',
     'Slow down on key phrases. Let silences breathe. Slightly lower pitch at critical moments.',
     1, 20),

    (3, 'global', 'Intimate Whisper',
     'Close-mic, hushed, personal tone for meditation or ASMR content.',
     'wellness', 'slow', 'low', 'warm', 'casual', 'generous',
     'Speak as if confiding in the listener. Reduce breath sounds. Gentle upward drift at phrase ends.',
     1, 30),

    (4, 'global', 'Energetic Ad Read',
     'Upbeat, punchy commercial delivery.',
     'commercial', 'brisk', 'high', 'playful', 'highly_articulated', 'minimal',
     'Hit product names with emphasis. Short punchy sentences. End with strong call-to-action energy.',
     1, 40),

    (5, 'global', 'Friendly Explainer',
     'Conversational, approachable educational tone.',
     'education', 'conversational', 'moderate', 'warm', 'clear', 'natural',
     'Sound like a knowledgeable friend. Use natural emphasis. Never sound patronising.',
     1, 50),

    (6, 'global', 'Documentary',
     'Measured, authoritative narration with gravitas.',
     'documentary', 'measured', 'moderate', 'neutral', 'precise', 'natural',
     'Project authority without pomposity. Honour the weight of the subject matter.',
     1, 60),

    (7, 'global', 'Trailer',
     'Bold, punchy, cinematic delivery for promos and trailers.',
     'trailer', 'brisk', 'elevated', 'intense', 'highly_articulated', 'minimal',
     'Each line is a beat. Land every word. Short dramatic pauses between lines.',
     1, 70),

    (8, 'global', 'Bedtime Story',
     'Gentle, lilting, soothing narrative for children or sleep content.',
     'character', 'slow', 'low', 'warm', 'casual', 'generous',
     'Use a slightly singsongy cadence. Soften consonants. Draw out vowels on comforting words.',
     1, 80);
