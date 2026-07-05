import { beforeEach, describe, expect, it, vi } from "vitest";
import * as BookCommands from "../../bindings/BookCommands";
import { readingProgressChanged } from "../../store/actions";
import { createMockReadBook } from "../../test/factories";
import { type AppStore, createTestStore } from "../../test/utils";
import { ErrorCode } from "../../types/Error";
import historyReducer, {
  clearAllHistory,
  clearHistory,
  clearHistoryError,
  fetchRecentlyReadBooks,
} from "./slice";

describe("HistoryReducer", () => {
  let store: AppStore;

  const initialState = {
    recentlyReadBooks: [],
    status: "idle" as const,
    error: null as { code: ErrorCode; message?: string } | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store = createTestStore();
  });

  // Verify that initial state is returned correctly
  it("should return the initial state", () => {
    expect(historyReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  // Verify that history related error state is cleared correctly
  it("should handle clearHistoryError", () => {
    const stateWithError = structuredClone(initialState);
    stateWithError.error = { code: ErrorCode.OTHER_ERROR, message: "test error" };
    const nextState = historyReducer(stateWithError, clearHistoryError());
    expect(nextState.error).toBeNull();
  });

  // Verify that readingProgressChanged patches the matching book in place.
  it("should patch the matching book on readingProgressChanged", () => {
    const state = {
      ...initialState,
      recentlyReadBooks: [
        createMockReadBook({ id: 1, last_read_page_index: 0 }),
        createMockReadBook({ id: 2, last_read_page_index: 5 }),
      ],
    };
    const nextState = historyReducer(
      state,
      readingProgressChanged({
        book_id: 2,
        last_read_page_index: 9,
        last_opened_at: "2026-07-04T10:00:00",
      }),
    );
    expect(nextState.recentlyReadBooks[0].last_read_page_index).toBe(0);
    expect(nextState.recentlyReadBooks[1].last_read_page_index).toBe(9);
    expect(nextState.recentlyReadBooks[1].last_opened_at).toBe("2026-07-04T10:00:00");
  });

  // Verify that readingProgressChanged for an unknown book id is a no-op.
  it("should ignore readingProgressChanged for an unknown book id", () => {
    const state = {
      ...initialState,
      recentlyReadBooks: [createMockReadBook({ id: 1, last_read_page_index: 3 })],
    };
    const nextState = historyReducer(
      state,
      readingProgressChanged({
        book_id: 999,
        last_read_page_index: 42,
        last_opened_at: "2026-07-04T10:00:00",
      }),
    );
    expect(nextState.recentlyReadBooks[0].last_read_page_index).toBe(3);
  });

  describe("Async Thunk Integration Tests", () => {
    const mockReadBook = createMockReadBook({
      id: 1,
      display_name: "Book 1",
      file_path: "p1",
    });

    // Verify that state is updated correctly on successful fetching of recently read books
    it("fetchRecentlyReadBooks should update state on success", async () => {
      vi.mocked(BookCommands.getRecentlyReadBooks).mockResolvedValue([mockReadBook]);

      await store.dispatch(fetchRecentlyReadBooks());

      const state = store.getState().history;
      expect(state.status).toBe("succeeded");
      expect(state.recentlyReadBooks).toEqual([mockReadBook]);
    });

    // Verify that book history removal is successful
    it("clearHistory should update status on success", async () => {
      vi.mocked(BookCommands.clearReadingHistory).mockResolvedValue(undefined);

      await store.dispatch(clearHistory(1));

      const state = store.getState().history;
      expect(state.status).toBe("succeeded");
      expect(BookCommands.clearReadingHistory).toHaveBeenCalledWith(1);
    });

    // Verify that clearing all history is successful
    it("clearAllHistory should update status on success", async () => {
      vi.mocked(BookCommands.clearAllReadingHistory).mockResolvedValue(undefined);

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
        expect(nextState.error).toBeNull();
      });

      // Verify handling of CommandError when fetching recently read books
      it("fetchRecentlyReadBooks should handle CommandError", async () => {
        const { CommandError } = await import("../../types/Error");
        const mockError = new CommandError(ErrorCode.IO_ERROR, "io error");
        vi.mocked(BookCommands.getRecentlyReadBooks).mockRejectedValue(mockError);

        await store.dispatch(fetchRecentlyReadBooks());

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.IO_ERROR);
        expect(state.error?.message).toContain("io error");
      });

      // Verify handling of CommandError when clearing history
      it("clearHistory should handle CommandError", async () => {
        const { CommandError } = await import("../../types/Error");
        const mockError = new CommandError(ErrorCode.IO_ERROR, "io error");
        vi.mocked(BookCommands.clearReadingHistory).mockRejectedValue(mockError);

        await store.dispatch(clearHistory(1));

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.IO_ERROR);
        expect(state.error?.message).toContain("io error");
      });

      // Verify handling of CommandError when clearing all history
      it("clearAllHistory should handle CommandError", async () => {
        const { CommandError } = await import("../../types/Error");
        const mockError = new CommandError(ErrorCode.IO_ERROR, "io error");
        vi.mocked(BookCommands.clearAllReadingHistory).mockRejectedValue(mockError);

        await store.dispatch(clearAllHistory());

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(state.error?.code).toBe(ErrorCode.IO_ERROR);
        expect(state.error?.message).toContain("io error");
      });

      // Verify that failed status and error message are set on fetch error
      it("fetchRecentlyReadBooks should set failed status and error message on error", async () => {
        const testError = "fetch failed";
        vi.mocked(BookCommands.getRecentlyReadBooks).mockRejectedValue(testError);

        await store.dispatch(fetchRecentlyReadBooks());

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(state.error?.message).toContain(testError);
      });

      // Verify that failed status and error message are set on clear error
      it("clearHistory should set failed status and error message on error", async () => {
        const testError = "clear failed";
        vi.mocked(BookCommands.clearReadingHistory).mockRejectedValue(testError);

        await store.dispatch(clearHistory(1));

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(state.error?.message).toContain(testError);
      });

      // Verify that failed status and error message are set on clear all error
      it("clearAllHistory should set failed status and error message on error", async () => {
        const testError = "clear all failed";
        vi.mocked(BookCommands.clearAllReadingHistory).mockRejectedValue(testError);

        await store.dispatch(clearAllHistory());

        const state = store.getState().history;
        expect(state.status).toBe("failed");
        expect(state.error?.message).toContain(testError);
      });
    });
  });
});
