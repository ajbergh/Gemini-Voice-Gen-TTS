-- 005_add_preset_color.sql
-- This is a no-op if the column already exists (handled in Go migration runner).
-- The actual ALTER TABLE is applied programmatically.
SELECT 1;
