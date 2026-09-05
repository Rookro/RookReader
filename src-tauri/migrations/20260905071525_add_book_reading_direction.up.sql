-- The page direction this book opens with. Seeded from `reader.comic.readingDirection`
-- the first time the book is opened, then overwritten whenever the reader flips it in the
-- navigation bar. Beside is_spread_shifted rather than in reading_state: it describes the
-- book, and turning reading history off — or clearing it — must not discard it. NULL until
-- the book has been opened once, and always NULL for novels, whose direction comes from
-- the EPUB itself and cannot be overridden.
ALTER TABLE books ADD COLUMN reading_direction TEXT CHECK(reading_direction IN ('rtl', 'ltr'));

-- Rebuilt rather than altered: SQLite has no CREATE OR REPLACE VIEW.
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
    b.is_spread_shifted,
    b.landscape_bits,
    b.reading_direction,
    r.last_read_page_index,
    r.last_opened_at,
    r.cfi,
    CAST((SELECT GROUP_CONCAT(tag_id) FROM book_tags WHERE book_id = b.id) AS TEXT) AS tag_ids_str
FROM books b
LEFT JOIN reading_state r ON b.id = r.book_id;
