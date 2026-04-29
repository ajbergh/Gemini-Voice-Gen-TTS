-- 012_take_metadata.sql
-- Adds audio analysis metadata columns to segment_takes.
-- duration_seconds already exists from migration 010; analysis and format
-- columns are added in store.prepareDatabase via addColumnIfMissing.
-- The actual ALTER TABLE is applied programmatically via addColumnIfMissing.
SELECT 1;
