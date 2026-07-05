import type { Dispatch, MiddlewareAPI, UnknownAction } from "@reduxjs/toolkit";
import { error } from "@tauri-apps/plugin-log";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as bookCommands from "../../bindings/BookCommands";
import { readingStateMiddleware } from "./readingStateMiddleware";

const run = (
  store: { getState: ReturnType<typeof vi.fn>; dispatch: ReturnType<typeof vi.fn> },
  next: Dispatch<UnknownAction>,
  action: unknown,
) => readingStateMiddleware(store as MiddlewareAPI)(next as (action: unknown) => unknown)(action);

const stateFor = (book: unknown, recordReadingHistory = true, index = 10) => ({
  settings: { history: { recordReadingHistory } },
  read: {
    containerFile: {
      history: ["path1"],
      historyIndex: 0,
      index,
      book,
    },
  },
});

describe("readingStateMiddleware", () => {
  let store: {
    getState: ReturnType<typeof vi.fn>;
    dispatch: ReturnType<typeof vi.fn>;
  };
  let next: Dispatch<UnknownAction>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    store = {
      getState: vi.fn(() => stateFor({ id: 1, last_opened_at: "now" })),
      dispatch: vi.fn(),
    };
    next = vi.fn((action: UnknownAction) => action) as Dispatch<UnknownAction>;
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // Verify that reading state is saved to the DB only after the debounce window elapses.
  it("should call updateReadingProgress after the debounce window when read/setImageIndex is dispatched", async () => {
    const action = { type: "read/setImageIndex", payload: 10 };
    run(store, next, action);

    expect(bookCommands.updateReadingProgress).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(500);

    expect(bookCommands.updateReadingProgress).toHaveBeenCalledWith({
      book_id: 1,
      last_read_page_index: 10,
      last_opened_at: "now",
    });
  });

  // Verify that two rapid same-book writes coalesce into a single write with the last args.
  it("should coalesce rapid same-book writes into the last one", async () => {
    store.getState.mockImplementation(() => stateFor({ id: 1, last_opened_at: "now" }, true, 10));
    run(store, next, { type: "read/setImageIndex", payload: 10 });

    store.getState.mockImplementation(() => stateFor({ id: 1, last_opened_at: "now" }, true, 20));
    run(store, next, { type: "read/setImageIndex", payload: 20 });

    await vi.advanceTimersByTimeAsync(500);

    expect(bookCommands.updateReadingProgress).toHaveBeenCalledTimes(1);
    expect(bookCommands.updateReadingProgress).toHaveBeenCalledWith({
      book_id: 1,
      last_read_page_index: 20,
      last_opened_at: "now",
    });
  });

  // Verify that switching books flushes the previous book's pending write immediately
  // with its own args, so a book switch never discards the previous position.
  it("should flush the previous book's write immediately when the book changes", async () => {
    store.getState.mockImplementation(() => stateFor({ id: 1, last_opened_at: "a" }, true, 10));
    run(store, next, { type: "read/setImageIndex", payload: 10 });

    // Switch to book 2 within the debounce window: book 1 must be flushed now.
    store.getState.mockImplementation(() => stateFor({ id: 2, last_opened_at: "b" }, true, 3));
    run(store, next, { type: "read/setImageIndex", payload: 3 });

    expect(bookCommands.updateReadingProgress).toHaveBeenCalledTimes(1);
    expect(bookCommands.updateReadingProgress).toHaveBeenCalledWith({
      book_id: 1,
      last_read_page_index: 10,
      last_opened_at: "a",
    });

    // Book 2 still fires later on its own debounce.
    await vi.advanceTimersByTimeAsync(500);
    expect(bookCommands.updateReadingProgress).toHaveBeenCalledTimes(2);
    expect(bookCommands.updateReadingProgress).toHaveBeenLastCalledWith({
      book_id: 2,
      last_read_page_index: 3,
      last_opened_at: "b",
    });
  });

  // Verify that reading state is not saved if history is disabled
  it("should not call updateReadingProgress if recordReadingHistory is false", async () => {
    store.getState.mockReturnValue({
      settings: {
        history: { recordReadingHistory: false },
      },
      read: { containerFile: {} },
    });

    run(store, next, { type: "read/setImageIndex", payload: 10 });
    await vi.advanceTimersByTimeAsync(500);

    expect(bookCommands.updateReadingProgress).not.toHaveBeenCalled();
  });

  // Verify that reading state is not saved if book is null
  it("should not call updateReadingProgress if book is null", async () => {
    store.getState.mockReturnValue(stateFor(null));

    run(store, next, { type: "read/setImageIndex", payload: 10 });
    await vi.advanceTimersByTimeAsync(500);

    expect(bookCommands.updateReadingProgress).not.toHaveBeenCalled();
  });

  // Verify that the fire-time re-check skips the write when history is disabled
  // after the write was scheduled (within the debounce window).
  it("should not persist if recordReadingHistory is disabled before the write fires", async () => {
    const enabledState = stateFor({ id: 1, last_opened_at: "now" });
    const disabledState = {
      settings: { history: { recordReadingHistory: false } },
      read: { containerFile: {} },
    };
    // Enabled when the write is scheduled (outer guard), disabled by the time the
    // debounced function fires and re-checks via the predicate.
    store.getState.mockReturnValueOnce(enabledState).mockReturnValue(disabledState);

    run(store, next, { type: "read/setImageIndex", payload: 10 });
    await vi.advanceTimersByTimeAsync(500);

    expect(bookCommands.updateReadingProgress).not.toHaveBeenCalled();
  });

  // Verify that reading state is saved to the DB when read/setNovelLocation action (for novels) is dispatched
  it("should call updateReadingProgress when read/setNovelLocation is dispatched", async () => {
    run(store, next, { type: "read/setNovelLocation", payload: { index: 5, cfi: "cfi" } });
    await vi.advanceTimersByTimeAsync(500);

    expect(bookCommands.updateReadingProgress).toHaveBeenCalledWith({
      book_id: 1,
      last_read_page_index: 10,
      last_opened_at: "now",
    });
  });

  // Verify that an error log is output if saving the reading state fails
  it("should handle updateReadingProgress error", async () => {
    vi.mocked(bookCommands.updateReadingProgress).mockRejectedValue(new Error("Database error"));

    run(store, next, { type: "read/setImageIndex", payload: 10 });
    await vi.advanceTimersByTimeAsync(500);

    expect(error).toHaveBeenCalledWith(expect.stringContaining("ReadingState update failed"));
  });

  // Verify that the middleware ignores non-object actions (e.g., strings) and passes them to the next handler
  it("should ignore non-object actions", () => {
    const result = run(store, next, "STRING_ACTION");

    expect(result).toBe("STRING_ACTION");
    expect(next).toHaveBeenCalledWith("STRING_ACTION");
    expect(bookCommands.updateReadingProgress).not.toHaveBeenCalled();
  });

  // Verify that the middleware ignores actions without a type property and passes them to the next handler
  it("should ignore actions without type", () => {
    const action = { noType: "here" };
    const result = run(store, next, action);

    expect(result).toEqual({ noType: "here" });
    expect(next).toHaveBeenCalledWith(action);
    expect(bookCommands.updateReadingProgress).not.toHaveBeenCalled();
  });
});
