PRAGMA foreign_keys = ON;

CREATE TABLE series (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT UNIQUE NOT NULL
);

CREATE TABLE books (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    file_path TEXT UNIQUE NOT NULL,
    item_type TEXT NOT NULL CHECK(item_type IN ('file', 'directory')),
    display_name TEXT NOT NULL,
    total_pages INTEGER NOT NULL DEFAULT 0,
    thumbnail_path TEXT,
    series_id INTEGER,
    series_order INTEGER,
    FOREIGN KEY (series_id) REFERENCES series(id) ON DELETE SET NULL
);

CREATE TABLE reading_state (
    book_id INTEGER PRIMARY KEY NOT NULL,
    last_read_page_index INTEGER NOT NULL DEFAULT 0,
    last_opened_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);
CREATE INDEX idx_reading_state_last_opened_at ON reading_state (last_opened_at DESC);

CREATE TABLE bookshelves (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT UNIQUE NOT NULL,
    icon_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE bookshelf_items (
    bookshelf_id INTEGER NOT NULL,
    book_id INTEGER NOT NULL,
    added_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (bookshelf_id, book_id),
    FOREIGN KEY (bookshelf_id) REFERENCES bookshelves(id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
);

CREATE TABLE tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    name TEXT UNIQUE NOT NULL,
    color_code TEXT NOT NULL
);

CREATE TABLE book_tags (
    book_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    PRIMARY KEY (book_id, tag_id),
    FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);
