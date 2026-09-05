```mermaid
erDiagram
    series ||--o{ books : "contains"
    books ||--o| reading_state : "has state"
    bookshelves ||--o{ bookshelf_items : "contains"
    books ||--o{ bookshelf_items : "placed in"
    books ||--o{ book_tags : "has tags"
    tags ||--o{ book_tags : "is assigned to"
    books ||--o{ bookmarks : "has bookmarks"
    books ||--|| book_with_state_view : "one row per book"
    book_with_state_view ||--o| reading_state : "left-joined"

    books {
        INTEGER id PK "AUTOINCREMENT"
        TEXT file_path UK "NOT NULL"
        TEXT item_type "NOT NULL; 'file' or 'directory'"
        TEXT display_name "NOT NULL"
        INTEGER total_pages "NOT NULL; default 0"
        TEXT thumbnail_path "nullable"
        INTEGER series_id FK "series.id; ON DELETE SET NULL; nullable"
        INTEGER series_order "nullable"
        DATETIME created_at "nullable"
        BOOLEAN is_spread_shifted "NOT NULL; default 0"
        TEXT landscape_bits "nullable; one '0'/'1' per page, '1' where landscape"
        TEXT reading_direction "nullable; 'rtl' or 'ltr'"
    }

    series {
        INTEGER id PK "AUTOINCREMENT"
        TEXT name UK "NOT NULL"
        DATETIME created_at "NOT NULL; default CURRENT_TIMESTAMP"
    }

    reading_state {
        INTEGER book_id PK, FK "books.id; ON DELETE CASCADE"
        INTEGER last_read_page_index "NOT NULL; default 0"
        DATETIME last_opened_at "nullable; default CURRENT_TIMESTAMP"
        TEXT cfi "nullable; EPUB CFI, NULL for comics"
    }

    bookshelves {
        INTEGER id PK "AUTOINCREMENT"
        TEXT name UK "NOT NULL"
        TEXT icon_id "NOT NULL"
        DATETIME created_at "NOT NULL; default CURRENT_TIMESTAMP"
    }

    bookshelf_items {
        INTEGER bookshelf_id PK, FK "bookshelves.id; ON DELETE CASCADE"
        INTEGER book_id PK, FK "books.id; ON DELETE CASCADE"
        DATETIME added_at "NOT NULL; default CURRENT_TIMESTAMP"
    }

    tags {
        INTEGER id PK "AUTOINCREMENT"
        TEXT name UK "NOT NULL"
        TEXT color_code "NOT NULL"
    }

    book_tags {
        INTEGER book_id PK, FK "books.id; ON DELETE CASCADE"
        INTEGER tag_id PK, FK "tags.id; ON DELETE CASCADE"
    }

    bookmarks {
        INTEGER id PK "AUTOINCREMENT"
        INTEGER book_id FK "books.id; NOT NULL; ON DELETE CASCADE"
        TEXT name "NOT NULL"
        INTEGER page_index "NOT NULL; comic page or EPUB section index"
        TEXT cfi "nullable; EPUB CFI, NULL for comics"
        DATETIME created_at "NOT NULL; default CURRENT_TIMESTAMP"
    }

    book_with_state_view {
        INTEGER id "VIEW; books.id"
        TEXT file_path "books"
        TEXT item_type "books"
        TEXT display_name "books"
        INTEGER total_pages "books"
        INTEGER series_id "books"
        INTEGER series_order "books"
        TEXT thumbnail_path "books"
        DATETIME created_at "books"
        BOOLEAN is_spread_shifted "books"
        TEXT landscape_bits "books"
        TEXT reading_direction "books"
        INTEGER last_read_page_index "reading_state; NULL when unread"
        DATETIME last_opened_at "reading_state; NULL when unread"
        TEXT cfi "reading_state; NULL when unread"
        TEXT tag_ids_str "GROUP_CONCAT of book_tags.tag_id"
    }

    _sqlx_migrations {
        BIGINT version PK "owned by sqlx, not the application"
        TEXT description "NOT NULL"
        TIMESTAMP installed_on "NOT NULL; default CURRENT_TIMESTAMP"
        BOOLEAN success "NOT NULL"
        BLOB checksum "NOT NULL"
        BIGINT execution_time "NOT NULL"
    }

    sqlite_sequence {
        ANY name "owned by SQLite, not the application; no declared type"
        ANY seq "no declared type"
    }
```

## Notes

`book_with_state_view` is a view, not a table: it joins each book to its reading state and
its tag ids so a book and its progress can be read in one query. It carries every `books`
column, so any column added there must be added to the view as well — SQLite has no
`CREATE OR REPLACE VIEW`, so a migration drops and recreates it.

`_sqlx_migrations` is created and maintained by the sqlx migration runner, and
`sqlite_sequence` by SQLite itself to hold the `AUTOINCREMENT` counters. Both are listed
because they exist in the database file, but neither is application schema and neither is
written by application code.

## Indexes

Besides the implicit indexes SQLite creates for primary keys and `UNIQUE` columns:

| Index | Definition |
| --- | --- |
| `idx_reading_state_last_opened_at` | `reading_state (last_opened_at DESC)` |
| `idx_bookmarks_book_id` | `bookmarks (book_id)` |
