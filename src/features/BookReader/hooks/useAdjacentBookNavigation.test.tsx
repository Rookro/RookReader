import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";
import { Provider } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  type AppStore,
  createBasePreloadedState,
  createTestStore,
  type RootState,
  testI18n,
} from "../../../test/utils";
import { bookPathOpened, openBook } from "../slice";
import { resolveAdjacentBook } from "../utils/AdjacentBookResolver";
import { useAdjacentBookNavigation } from "./useAdjacentBookNavigation";

const { showNotification } = vi.hoisted(() => ({ showNotification: vi.fn() }));

vi.mock("../../../components/ui/Notification/NotificationContext", () => ({
  useNotification: () => ({ showNotification }),
}));

vi.mock("../slice", async () => {
  const actual = await vi.importActual("../slice");
  return {
    ...actual,
    openBook: vi.fn((payload: unknown) => ({ type: "reader/openBook", payload })),
  };
});

vi.mock("../utils/AdjacentBookResolver", () => ({
  resolveAdjacentBook: vi.fn(),
}));

const mockedResolve = vi.mocked(resolveAdjacentBook);

const buildState = (mode: "off" | "ask" | "auto"): RootState => {
  const state = createBasePreloadedState();
  state.settings.reader.autoOpenAdjacentBook = mode;
  state.reader.history = ["/dir/book1.zip"];
  state.reader.historyIndex = 0;
  state.reader.origin = { kind: "fileNavigator" };
  return state;
};

const renderTrigger = (state: RootState) => {
  const store: AppStore = createTestStore(state);
  const dispatchSpy = vi.spyOn(store, "dispatch");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>
      <I18nextProvider i18n={testI18n}>{children}</I18nextProvider>
    </Provider>
  );
  const { result } = renderHook(() => useAdjacentBookNavigation(), { wrapper });
  return { result, dispatchSpy, store };
};

describe("useAdjacentBookNavigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when the mode is off", async () => {
    const { result, dispatchSpy } = renderTrigger(buildState("off"));

    await act(async () => {
      result.current.onForwardBoundary();
    });

    expect(mockedResolve).not.toHaveBeenCalled();
    expect(showNotification).not.toHaveBeenCalled();
    expect(dispatchSpy).not.toHaveBeenCalled();
  });

  it("auto-opens the next book and shows a toast", async () => {
    mockedResolve.mockResolvedValue({ filePath: "/dir/book2.zip", displayName: "Book 2" });
    const { result } = renderTrigger(buildState("auto"));

    await act(async () => {
      result.current.onForwardBoundary();
    });

    expect(mockedResolve).toHaveBeenCalledWith(
      null,
      "/dir/book1.zip",
      { kind: "fileNavigator" },
      "next",
      "name_asc",
    );
    // Next book opens on its first page.
    expect(openBook).toHaveBeenCalledWith({
      path: "/dir/book2.zip",
      origin: { kind: "fileNavigator" },
      initialPosition: "first",
    });
    expect(showNotification).toHaveBeenCalledWith(expect.stringContaining("Book 2"), "info");
  });

  it("opens the previous book on its last page", async () => {
    mockedResolve.mockResolvedValue({ filePath: "/dir/book0.zip", displayName: "Book 0" });
    const { result } = renderTrigger(buildState("auto"));

    await act(async () => {
      result.current.onBackwardBoundary();
    });

    expect(openBook).toHaveBeenCalledWith({
      path: "/dir/book0.zip",
      origin: { kind: "fileNavigator" },
      initialPosition: "last",
    });
    expect(showNotification).toHaveBeenCalledWith(expect.stringContaining("Book 0"), "info");
  });

  it("shows a 'no next book' toast when none is found", async () => {
    mockedResolve.mockResolvedValue(null);
    const { result } = renderTrigger(buildState("auto"));

    await act(async () => {
      result.current.onForwardBoundary();
    });

    expect(showNotification).toHaveBeenCalledWith("No next book found.", "info");
    expect(openBook).not.toHaveBeenCalled();
  });

  it("shows an error toast when resolution fails", async () => {
    mockedResolve.mockRejectedValue(new Error("backend boom"));
    const { result } = renderTrigger(buildState("auto"));

    await act(async () => {
      result.current.onForwardBoundary();
    });

    expect(showNotification).toHaveBeenCalledWith("Failed to open the adjacent book.", "error");
    expect(openBook).not.toHaveBeenCalled();
  });

  it("asks for confirmation in 'ask' mode before opening", async () => {
    mockedResolve.mockResolvedValue({ filePath: "/dir/book2.zip", displayName: "Book 2" });
    const { result } = renderTrigger(buildState("ask"));

    await act(async () => {
      result.current.onForwardBoundary();
    });

    // Pending is set; nothing is opened yet.
    expect(result.current.pending).toEqual({
      book: { filePath: "/dir/book2.zip", displayName: "Book 2" },
      direction: "next",
    });
    expect(openBook).not.toHaveBeenCalled();

    // Confirming opens the book.
    act(() => {
      result.current.confirmPending();
    });

    expect(openBook).toHaveBeenCalledWith({
      path: "/dir/book2.zip",
      origin: { kind: "fileNavigator" },
      initialPosition: "first",
    });
    expect(result.current.pending).toBeNull();
  });

  it("cancels a pending confirmation without opening", async () => {
    mockedResolve.mockResolvedValue({ filePath: "/dir/book2.zip", displayName: "Book 2" });
    const { result } = renderTrigger(buildState("ask"));

    await act(async () => {
      result.current.onForwardBoundary();
    });
    act(() => {
      result.current.cancelPending();
    });

    expect(result.current.pending).toBeNull();
    expect(openBook).not.toHaveBeenCalled();
  });

  it("guards against concurrent triggers while resolving", async () => {
    // Never resolves, so the first call keeps the in-progress guard active.
    mockedResolve.mockReturnValue(new Promise(() => {}));
    const { result } = renderTrigger(buildState("auto"));

    await act(async () => {
      result.current.onForwardBoundary();
      result.current.onForwardBoundary();
    });

    expect(mockedResolve).toHaveBeenCalledTimes(1);
  });

  /** A resolution the test settles itself. */
  const heldResolve = () => {
    let settle: (book: { filePath: string; displayName: string } | null) => void = () => {};
    mockedResolve.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    return (book: { filePath: string; displayName: string } | null) => settle(book);
  };

  it("forgets the confirm dialog when another book opens", async () => {
    mockedResolve.mockResolvedValue({ filePath: "/dir/book2.zip", displayName: "Book 2" });
    const { result, store } = renderTrigger(buildState("ask"));
    await act(async () => {
      result.current.onForwardBoundary();
    });
    expect(result.current.pending).not.toBeNull();

    act(() => {
      store.dispatch(bookPathOpened({ path: "/dir/other.zip", origin: null }));
    });

    expect(result.current.pending).toBeNull();
  });

  it.each([{ found: { filePath: "/dir/book2.zip", displayName: "Book 2" } }, { found: null }])(
    "ignores a neighbour found for the book it has left ($found)",
    async ({ found }) => {
      const settle = heldResolve();
      const { result, store } = renderTrigger(buildState("auto"));
      act(() => {
        result.current.onForwardBoundary();
      });

      act(() => {
        store.dispatch(bookPathOpened({ path: "/dir/other.zip", origin: null }));
      });
      await act(async () => {
        settle(found);
      });

      expect(openBook).not.toHaveBeenCalled();
      expect(showNotification).not.toHaveBeenCalled();
    },
  );

  it("reports no failure for the book it has left", async () => {
    let fail: (reason: Error) => void = () => {};
    mockedResolve.mockReturnValueOnce(
      new Promise((_, reject) => {
        fail = reject;
      }),
    );
    const { result, store } = renderTrigger(buildState("auto"));
    act(() => {
      result.current.onForwardBoundary();
    });

    act(() => {
      store.dispatch(bookPathOpened({ path: "/dir/other.zip", origin: null }));
    });
    await act(async () => {
      fail(new Error("listing failed"));
    });

    expect(showNotification).not.toHaveBeenCalled();
  });

  // On the old code this fails at the first `toHaveBeenCalledTimes(2)` (got 1): nothing
  // resets `isResolving`, so the new book's first trigger is dropped.
  it("does not let the left book's request unlock the new book's", async () => {
    const settleOld = heldResolve();
    heldResolve();
    const { result, store } = renderTrigger(buildState("auto"));
    act(() => {
      result.current.onForwardBoundary();
    });
    act(() => {
      store.dispatch(bookPathOpened({ path: "/dir/other.zip", origin: null }));
    });
    act(() => {
      result.current.onForwardBoundary();
    });
    expect(mockedResolve).toHaveBeenCalledTimes(2);

    await act(async () => {
      settleOld(null);
    });
    act(() => {
      result.current.onForwardBoundary();
    });

    expect(mockedResolve).toHaveBeenCalledTimes(2);
  });
});
