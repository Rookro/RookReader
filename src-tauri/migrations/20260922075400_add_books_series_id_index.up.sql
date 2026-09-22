-- Series pages filter and order books by series_id; without an index every lookup scans
-- the whole table, and assigning a book to a series scans it again for MAX(series_order).
CREATE INDEX idx_books_series_id ON books (series_id);
