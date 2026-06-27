-- Add a real creation timestamp to standalone books so the bookshelf can sort by
-- date. SQLite forbids a non-constant default (CURRENT_TIMESTAMP) in ALTER TABLE
-- ADD COLUMN, so the column is added nullable and existing rows are backfilled.
-- New rows are stamped explicitly by the repository on insert (see register_book /
-- record_book_opened).
ALTER TABLE books ADD COLUMN created_at DATETIME;
UPDATE books SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL;

-- Recreate the view so `created_at` is surfaced alongside the other book columns.
DROP VIEW IF EXISTS book_with_state_view;
CREATE VIEW book_with_state_view AS
SELECT
    b.id,
    b.file_path,
    b.item_type,
    b.display_name,
    b.total_pages,
    b.series_id,
    b.series_order,
    b.thumbnail_path,
    b.created_at,
    r.last_read_page_index,
    r.last_opened_at,
    CAST((SELECT GROUP_CONCAT(tag_id) FROM book_tags WHERE book_id = b.id) AS TEXT) AS tag_ids_str
FROM books b
LEFT JOIN reading_state r ON b.id = r.book_id;
