import { describe, it, expect, vi, beforeEach } from "vitest";
import { readingStateMiddleware } from "./readingStateMiddleware";
import * as bookCommands from "../bindings/BookCommands";
import { error } from "@tauri-apps/plugin-log";
import { UnknownAction, Dispatch, MiddlewareAPI } from "@reduxjs/toolkit";

vi.mock("@mui/material", () => ({
  debounce: <T extends (...args: unknown[]) => unknown>(fn: T) => fn, // No debounce for testing
}));

describe("readingStateMiddleware", () => {
  let store: {
    getState: ReturnType<typeof vi.fn>;
    dispatch: ReturnType<typeof vi.fn>;
  };
  let next: Dispatch<UnknownAction>;

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      getState: vi.fn(() => ({
        view: { enableHistory: true },
        read: {
          containerFile: {
            history: ["path1"],
            historyIndex: 0,
            index: 10,
            book: { id: 1, last_opened_at: "now" },
          },
        },
      })),
      dispatch: vi.fn(),
    };
    next = vi.fn((action: UnknownAction) => action) as unknown as Dispatch<UnknownAction>;
  });

  // Verify that reading state (page index, etc.) is saved to the DB when read/setImageIndex action is dispatched
  it("should call upsertReadingState when read/setImageIndex is dispatched", async () => {
    const action = { type: "read/setImageIndex", payload: 10 };
    await readingStateMiddleware(store as unknown as MiddlewareAPI)(
      next as (action: unknown) => unknown,
    )(action);

    expect(bookCommands.upsertReadingState).toHaveBeenCalledWith({
      book_id: 1,
      last_read_page_index: 10,
      last_opened_at: "now",
    });
  });

  // Verify that reading state is not saved if history is disabled
  it("should not call upsertReadingState if enableHistory is false", async () => {
    store.getState.mockReturnValue({
      view: { enableHistory: false },
      read: { containerFile: {} },
    });

    const action = { type: "read/setImageIndex", payload: 10 };
    await readingStateMiddleware(store as unknown as MiddlewareAPI)(
      next as (action: unknown) => unknown,
    )(action);

    expect(bookCommands.upsertReadingState).not.toHaveBeenCalled();
  });

  // Verify that reading state is saved to the DB when read/setNovelLocation action (for novels) is dispatched
  it("should call upsertReadingState when read/setNovelLocation is dispatched", async () => {
    const action = { type: "read/setNovelLocation", payload: { index: 5, cfi: "cfi" } };
    await readingStateMiddleware(store as unknown as MiddlewareAPI)(
      next as (action: unknown) => unknown,
    )(action);

    expect(bookCommands.upsertReadingState).toHaveBeenCalledWith({
      book_id: 1,
      last_read_page_index: 10,
      last_opened_at: "now",
    });
  });

  // Verify that an error log is output if saving the reading state fails
  it("should handle upsertReadingState error", async () => {
    vi.mocked(bookCommands.upsertReadingState).mockRejectedValue(new Error("Database error"));
    const action = { type: "read/setImageIndex", payload: 10 };
    await readingStateMiddleware(store as unknown as MiddlewareAPI)(
      next as (action: unknown) => unknown,
    )(action);

    expect(error).toHaveBeenCalledWith(expect.stringContaining("ReadingState update failed"));
  });

  // Verify that the middleware ignores non-object actions (e.g., strings) and passes them to the next handler
  it("should ignore non-object actions", async () => {
    const action = "STRING_ACTION";
    const result = await readingStateMiddleware(store as unknown as MiddlewareAPI)(
      next as (action: unknown) => unknown,
    )(action);

    expect(result).toBe("STRING_ACTION");
    expect(next).toHaveBeenCalledWith("STRING_ACTION");
    expect(bookCommands.upsertReadingState).not.toHaveBeenCalled();
  });

  // Verify that the middleware ignores actions without a type property and passes them to the next handler
  it("should ignore actions without type", async () => {
    const action = { noType: "here" };
    const result = await readingStateMiddleware(store as unknown as MiddlewareAPI)(
      next as (action: unknown) => unknown,
    )(action);

    expect(result).toEqual({ noType: "here" });
    expect(next).toHaveBeenCalledWith(action);
    expect(bookCommands.upsertReadingState).not.toHaveBeenCalled();
  });
});
