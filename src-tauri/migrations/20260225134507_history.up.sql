CREATE TABLE history (
    id INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    type TEXT CHECK(type IN ('FILE', 'DIRECTORY')) NOT NULL,
    display_name TEXT NOT NULL,
    page_index INTEGER NOT NULL DEFAULT 0,
    last_opened_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_last_opened_at ON history(last_opened_at DESC);
