ALTER TABLE collection_items RENAME COLUMN collection_id TO bookshelf_id;
ALTER TABLE collection_items RENAME TO bookshelf_items;
ALTER TABLE collections RENAME TO bookshelves;
