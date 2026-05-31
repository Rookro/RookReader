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
    r.last_read_page_index,
    r.last_opened_at,
    CAST((SELECT GROUP_CONCAT(tag_id) FROM book_tags WHERE book_id = b.id) AS TEXT) AS tag_ids_str
FROM books b
LEFT JOIN reading_state r ON b.id = r.book_id;
