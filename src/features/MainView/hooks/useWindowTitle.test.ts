import { getCurrentWindow } from "@tauri-apps/api/window";
import { error } from "@tauri-apps/plugin-log";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBasePreloadedState, createTestStore, createTestWrapper } from "../../../test/utils";
import { bookPathOpened } from "../../BookReader/slice";
import { useWindowTitle } from "./useWindowTitle";

describe("useWindowTitle", () => {
  const setTitle = vi.fn(() => Promise.resolve());

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getCurrentWindow).mockReturnValue({ setTitle } as unknown as ReturnType<
      typeof getCurrentWindow
    >);
  });

  const renderWithBook = (path: string | null) => {
    const preloadedState = createBasePreloadedState();
    if (path) {
      preloadedState.reader.history = [path];
      preloadedState.reader.historyIndex = 0;
    }
    const store = createTestStore(preloadedState);
    renderHook(() => useWindowTitle(), { wrapper: createTestWrapper({ store }) });
    return store;
  };

  it("names only the app while no book is open", async () => {
    renderWithBook(null);
    await waitFor(() => expect(setTitle).toHaveBeenLastCalledWith("RookReader"));
  });

  it("names the open book", async () => {
    renderWithBook("C:\\books\\comic.zip\\Vol.1");
    await waitFor(() => expect(setTitle).toHaveBeenLastCalledWith("comic.zip/Vol.1 - RookReader"));
  });

  it("follows the book opened next", async () => {
    const store = renderWithBook("/books/a.zip");
    act(() => {
      store.dispatch(bookPathOpened({ path: "/books/b.pdf", origin: null }));
    });
    await waitFor(() => expect(setTitle).toHaveBeenLastCalledWith("b.pdf - RookReader"));
  });

  it("logs a title that could not be set", async () => {
    setTitle.mockRejectedValueOnce(new Error("not allowed"));
    renderWithBook("/books/a.zip");
    await waitFor(() =>
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to set the window title")),
    );
  });
});
