-- The collection entity was called a bookshelf; the bookshelf is now the library view.
ALTER TABLE bookshelves RENAME TO collections;
ALTER TABLE bookshelf_items RENAME TO collection_items;
ALTER TABLE collection_items RENAME COLUMN bookshelf_id TO collection_id;
