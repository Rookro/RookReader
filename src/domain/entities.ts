/**
 * Frontend names for the library entities the backend returns.
 *
 * The types are generated from the Rust entities into `../bindings/bindings.ts`. Specta
 * splits a type with `Option` fields into `X_Serialize` (every field present, `null` for
 * none) and `X_Deserialize` (those fields optional); commands return the `_Serialize`
 * shape, so these names alias it. The values come from our own backend, so they are not
 * validated at runtime.
 */
import type {
  Book_Serialize,
  Bookmark_Serialize,
  BookWithState_Serialize,
  Collection_Serialize,
  ReadBook_Serialize,
  ReadingState_Serialize,
} from "../bindings/bindings";

export type { Series, Tag } from "../bindings/bindings";

/** A book in the library. */
export type Book = Book_Serialize;

/** A book together with its reading state, which is null until the book is opened. */
export type BookWithState = BookWithState_Serialize;

/** A book that has been opened, with its reading state. */
export type ReadBook = ReadBook_Serialize;

/**
 * Where the reader is in a book. A null `last_opened_at` leaves it to the backend, which
 * records the current time.
 */
export type ReadingState = ReadingState_Serialize;

/** A named position in a book. */
export type Bookmark = Bookmark_Serialize;

/** A user-made collection of books. */
export type Collection = Collection_Serialize;
