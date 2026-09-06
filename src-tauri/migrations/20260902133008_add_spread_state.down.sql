-- Restore the view without the layout columns, then drop them. The view is dropped
-- first because SQLite refuses to drop a column referenced by a view.
DROP VIEW IF EXISTS book_with_state_view;
ALTER TABLE books DROP COLUMN is_spread_shifted;
ALTER TABLE books DROP COLUMN landscape_bits;
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
    r.cfi,
    CAST((SELECT GROUP_CONCAT(tag_id) FROM book_tags WHERE book_id = b.id) AS TEXT) AS tag_ids_str
FROM books b
LEFT JOIN reading_state r ON b.id = r.book_id;
