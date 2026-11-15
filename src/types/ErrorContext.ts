/** What the user was doing when an error occurred; picks the message's headline. */
export type ErrorContext =
  | "open-container"
  | "record-book"
  | "load-page"
  | "load-novel"
  | "explorer"
  | "history"
  | "bookshelf"
  | "tag"
  | "series"
  | "bookmark"
  | "settings-save";
