-- SQLite does not support dropping columns in older versions, but Tauri's bundled SQLite usually does (3.35.0+).
-- However, for maximum compatibility and following common patterns:
-- To truly revert, we would need to recreate the table.
-- But ALTER TABLE DROP COLUMN is available since 3.35.0.

ALTER TABLE series DROP COLUMN created_at;
