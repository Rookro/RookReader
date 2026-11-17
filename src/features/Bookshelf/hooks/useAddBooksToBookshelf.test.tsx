import { act, renderHook, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../bindings/api";
import { createBasePreloadedState, createTestWrapper, testI18n } from "../../../test/utils";
import { CommandError, ErrorCode } from "../../../types/Error";
import { useAddBooksToBookshelf } from "./useAddBooksToBookshelf";

describe("useAddBooksToBookshelf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderAddBooks = (collectionId: number | null = null) => {
    const preloadedState = createBasePreloadedState();
    preloadedState.collection.selectedId = collectionId;
    return renderHook(() => useAddBooksToBookshelf(), {
      wrapper: createTestWrapper({ preloadedState }),
    }).result;
  };

  it("reports how many books were added", async () => {
    vi.mocked(api.registerBook).mockResolvedValue(1);
    const addBooks = renderAddBooks();

    await act(() => addBooks.current(["/a.zip", "/b.zip"]));

    expect(await screen.findByText("Added 2 books.")).toBeInTheDocument();
  });

  it("adds to the collection shown", async () => {
    vi.mocked(api.registerBook).mockResolvedValue(7);
    const addBooks = renderAddBooks(5);

    await act(() => addBooks.current(["/a.zip"]));

    expect(api.addBookToCollection).toHaveBeenCalledWith(5, 7);
  });

  it("lists why the others could not be added", async () => {
    vi.mocked(api.registerBook)
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new CommandError(ErrorCode.emptyContainer, "empty"))
      .mockRejectedValueOnce(new CommandError(ErrorCode.emptyContainer, "empty"));
    const addBooks = renderAddBooks();

    await act(() => addBooks.current(["/a.zip", "/zips", "/more-zips"]));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Added 1 of 3. The others could not be added:");
    // Each reason once, however many paths failed for it.
    expect(alert.textContent?.match(/The book contains no readable pages\./g)).toHaveLength(1);
  });

  it("says when nothing could be added", async () => {
    vi.mocked(api.registerBook).mockRejectedValue(
      new CommandError(ErrorCode.emptyContainer, "empty"),
    );
    const addBooks = renderAddBooks();

    await act(() => addBooks.current(["/zips"]));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      // toHaveTextContent collapses the line break into a space.
      "The item could not be added: The book contains no readable pages.",
    );
  });

  // Japanese has no singular plural form, so one item uses the `other` message.
  it("says in Japanese when the one item could not be added", async () => {
    vi.mocked(api.registerBook).mockRejectedValueOnce(
      new CommandError(ErrorCode.emptyContainer, "empty"),
    );
    await testI18n.changeLanguage("ja-JP");
    try {
      const addBooks = renderAddBooks();

      await act(() => addBooks.current(["/zips"]));

      expect(await screen.findByRole("alert")).toHaveTextContent(
        "1 件を追加できませんでした: 読み込めるページがありません。",
      );
    } finally {
      await testI18n.changeLanguage("en-US");
    }
  });

  it("does nothing for no paths", async () => {
    const addBooks = renderAddBooks();

    await act(() => addBooks.current([]));

    expect(api.registerBook).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
