-- How the book pairs into two-page spreads: the measurement, and the reader's correction
-- to it. Both describe the book, so they sit beside total_pages rather than in
-- reading_state — which the reader can switch off (recordReadingHistory) or clear
-- outright, and neither must discard how a book is laid out.
ALTER TABLE books ADD COLUMN is_spread_shifted BOOLEAN NOT NULL DEFAULT 0;
-- One '0'/'1' per page, in entry order: '1' where the page is wider than it is tall. A
-- landscape page is one physical spread, which is what settles the parity. NULL until the
-- book has been measured once.
ALTER TABLE books ADD COLUMN landscape_bits TEXT;

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
    r.last_read_page_index,
    r.last_opened_at,
    r.cfi,
    CAST((SELECT GROUP_CONCAT(tag_id) FROM book_tags WHERE book_id = b.id) AS TEXT) AS tag_ids_str
FROM books b
LEFT JOIN reading_state r ON b.id = r.book_id;
