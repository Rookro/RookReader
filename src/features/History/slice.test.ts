import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../bindings/api";
import { readingProgressChanged } from "../../store/actions";
import { createMockBookWithState } from "../../test/factories";
import { type AppStore, createTestStore } from "../../test/utils";
import { ErrorCode } from "../../types/Error";
import historyReducer, { clearAllHistory, clearHistory, fetchRecentlyReadBooks } from "./slice";

describe("HistoryReducer", () => {
  let store: AppStore;

  const initialState = {
    recentlyReadBooks: [],
    status: "idle" as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  // Verify that initial state is returned correctly
  it("should return the initial state", () => {
    expect(historyReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  // Verify that readingProgressChanged patches the matching book in place.
  it("should patch the matching book on readingProgressChanged", () => {
    const state = {
      ...initialState,
      recentlyReadBooks: [
        createMockBookWithState({ id: 1, lastReadPageIndex: 0 }),
        createMockBookWithState({ id: 2, lastReadPageIndex: 5 }),
      ],
    };
    const nextState = historyReducer(
      state,
      readingProgressChanged({
        bookId: 2,
        lastReadPageIndex: 9,
        cfi: null,
        lastOpenedAt: "2026-07-04T10:00:00Z",
      }),
    );
    expect(nextState.recentlyReadBooks[0].lastReadPageIndex).toBe(0);
    expect(nextState.recentlyReadBooks[1].lastReadPageIndex).toBe(9);
    expect(nextState.recentlyReadBooks[1].lastOpenedAt).toBe("2026-07-04T10:00:00Z");
  });

  // A progress update without a timestamp does not blank the listed one.
  it("should keep lastOpenedAt when readingProgressChanged carries none", () => {
    const state = {
      ...initialState,
      recentlyReadBooks: [
        createMockBookWithState({
          id: 1,
          lastReadPageIndex: 0,
          lastOpenedAt: "2026-07-01T09:00:00Z",
        }),
      ],
    };
    const nextState = historyReducer(
      state,
      readingProgressChanged({
        bookId: 1,
        lastReadPageIndex: 4,
        cfi: null,
        lastOpenedAt: null,
      }),
    );
    expect(nextState.recentlyReadBooks[0].lastReadPageIndex).toBe(4);
    expect(nextState.recentlyReadBooks[0].lastOpenedAt).toBe("2026-07-01T09:00:00Z");
  });

  // Verify that readingProgressChanged for an unknown book id is a no-op.
  it("should ignore readingProgressChanged for an unknown book id", () => {
    const state = {
      ...initialState,
      recentlyReadBooks: [createMockBookWithState({ id: 1, lastReadPageIndex: 3 })],
    };
    const nextState = historyReducer(
      state,
      readingProgressChanged({
        bookId: 999,
        lastReadPageIndex: 42,
        cfi: null,
        lastOpenedAt: "2026-07-04T10:00:00Z",
      }),
    );
    expect(nextState.recentlyReadBooks[0].lastReadPageIndex).toBe(3);
  });

  describe("Async Thunk Integration Tests", () => {
    const mockBook = createMockBookWithState({
      id: 1,
      displayName: "Book 1",
      filePath: "p1",
    });

    // Verify that state is updated correctly on successful fetching of recently read books
    it("fetchRecentlyReadBooks should update state on success", async () => {
      vi.mocked(api.getRecentlyReadBooks).mockResolvedValue([mockBook]);

      await store.dispatch(fetchRecentlyReadBooks());

      expect(api.getRecentlyReadBooks).toHaveBeenCalledWith();
      const state = store.getState().history;
      expect(state.status).toBe("succeeded");
      expect(state.recentlyReadBooks).toEqual([mockBook]);
    });

    // Verify that book history removal is successful
    it("clearHistory should update status on success", async () => {
      vi.mocked(api.clearReadingHistory).mockResolvedValue(null);

      await store.dispatch(clearHistory(1));

      const state = store.getState().history;
      expect(state.status).toBe("succeeded");
      expect(api.clearReadingHistory).toHaveBeenCalledWith(1);
    });

    // Verify that clearing all history is successful
    it("clearAllHistory should update status on success", async () => {
      vi.mocked(api.clearAllReadingHistory).mockResolvedValue(null);

      await store.dispatch(clearAllHistory());

      const state = store.getState().history;
      expect(state.status).toBe("succeeded");
    });

    describe("Error Handling", () => {
      // Verify state update when rejected actions have undefined payload
      it("should handle rejected actions with undefined payload", () => {
        const action = { type: fetchRecentlyReadBooks.rejected.type, payload: undefined };
        const nextState = historyReducer(initialState, action);
        expect(nextState.status).toBe("failed");
      });

      // Verify handling of CommandError when fetching recently read books
      it("fetchRecentlyReadBooks should handle CommandError", async () => {
        const { CommandError } = await import("../../types/Error");
        const mockError = new CommandError(ErrorCode.io, "io error");
        vi.mocked(api.getRecentlyReadBooks).mockRejectedValue(mockError);

        await store.dispatch(fetchRecentlyReadBooks());

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "history", code: ErrorCode.io },
        ]);
      });

      // Verify handling of CommandError when clearing history
      it("clearHistory should handle CommandError", async () => {
        const { CommandError } = await import("../../types/Error");
        const mockError = new CommandError(ErrorCode.io, "io error");
        vi.mocked(api.clearReadingHistory).mockRejectedValue(mockError);

        await store.dispatch(clearHistory(1));

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "history", code: ErrorCode.io },
        ]);
      });

      // Verify handling of CommandError when clearing all history
      it("clearAllHistory should handle CommandError", async () => {
        const { CommandError } = await import("../../types/Error");
        const mockError = new CommandError(ErrorCode.io, "io error");
        vi.mocked(api.clearAllReadingHistory).mockRejectedValue(mockError);

        await store.dispatch(clearAllHistory());

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "history", code: ErrorCode.io },
        ]);
      });

      // Verify that a fetch error sets failed status and queues the failure
      it("fetchRecentlyReadBooks should set failed status and report the failure", async () => {
        const testError = "fetch failed";
        vi.mocked(api.getRecentlyReadBooks).mockRejectedValue(testError);

        await store.dispatch(fetchRecentlyReadBooks());

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "history", code: ErrorCode.other },
        ]);
      });

      // Verify that a clear error sets failed status and queues the failure
      it("clearHistory should set failed status and report the failure", async () => {
        const testError = "clear failed";
        vi.mocked(api.clearReadingHistory).mockRejectedValue(testError);

        await store.dispatch(clearHistory(1));

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "history", code: ErrorCode.other },
        ]);
      });

      // Verify that a clear-all error sets failed status and queues the failure
      it("clearAllHistory should set failed status and report the failure", async () => {
        const testError = "clear all failed";
        vi.mocked(api.clearAllReadingHistory).mockRejectedValue(testError);

        await store.dispatch(clearAllHistory());

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(store.getState().errorNotification.pending).toEqual([
          { context: "history", code: ErrorCode.other },
        ]);
      });
    });
  });
});
