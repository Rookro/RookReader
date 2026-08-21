-- Saved reading positions within a book. `page_index` is the comic page index or
-- the EPUB spine section index; `cfi` pins the exact position within an EPUB
-- section and is NULL for comics.
CREATE TABLE bookmarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    book_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    page_index INTEGER NOT NULL,
    cfi TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
CREATE INDEX idx_bookmarks_book_id ON bookmarks (book_id);
