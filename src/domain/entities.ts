/**
 * Frontend names for the entities the backend returns.
 *
 * Except `DirEntry`, the types are generated from the Rust entities into
 * `../bindings/bindings.ts`. Specta splits a type with `Option` fields into `X_Serialize`
 * (every field present, `null` for none) and `X_Deserialize` (those fields optional);
 * commands return the `_Serialize` shape, so these names alias it. The values come from
 * our own backend, so they are not validated at runtime.
 */
import type {
  Bookmark_Serialize,
  BookWithState_Serialize,
  Collection_Serialize,
  ReadingState_Serialize,
} from "../bindings/bindings";

export type { Series, Tag } from "../bindings/bindings";

/** A book together with its reading state, which is null until the book is opened. */
export type BookWithState = BookWithState_Serialize;

/** Where the reader is in a book, as the backend reports it after a page turn. */
export type ReadingState = ReadingState_Serialize;

/** A named position in a book. */
export type Bookmark = Bookmark_Serialize;

/** A user-made collection of books. */
export type Collection = Collection_Serialize;

/**
 * One row of the directory listing. The listing is a binary command, so this type is
 * written by hand and decoded from its bytes by `src/utils/DirEntryUtils.ts`.
 */
export type DirEntry = {
  /** Whether it is a directory. */
  isDirectory: boolean;
  /** Entry name. */
  name: string;
  /** Last modified time as a raw timestamp (ms), as sent by the backend. */
  lastModified: number;
};
