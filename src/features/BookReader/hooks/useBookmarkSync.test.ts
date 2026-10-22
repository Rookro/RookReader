import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookmarkCommands from "../../../bindings/BookmarkCommands";
import { createMockBookmark, createMockBookWithState } from "../../../test/factories";
import { createBasePreloadedState, createTestStore, createTestWrapper } from "../../../test/utils";
import { useBookmarkSync } from "./useBookmarkSync";

describe("useBookmarkSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches the bookmarks of the open book", async () => {
    const state = createBasePreloadedState();
    state.read.containerFile.book = createMockBookWithState({ id: 42 });
    const store = createTestStore(state);

    renderHook(() => useBookmarkSync(), { wrapper: createTestWrapper({ store }) });

    await waitFor(() => expect(BookmarkCommands.getBookmarksByBookId).toHaveBeenCalledWith(42));
  });

  it("clears the list when no book is open", () => {
    const state = createBasePreloadedState();
    state.bookmark = {
      bookId: 7,
      bookmarks: [createMockBookmark({ book_id: 7 })],
      status: "succeeded",
      error: null,
    };
    const store = createTestStore(state);

    renderHook(() => useBookmarkSync(), { wrapper: createTestWrapper({ store }) });

    expect(store.getState().bookmark.bookId).toBeNull();
    expect(store.getState().bookmark.bookmarks).toEqual([]);
  });
});
