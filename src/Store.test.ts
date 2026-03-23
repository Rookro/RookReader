import { describe, it, expect, vi } from "vitest";
import { createStore, RootState } from "./Store";
import { Middleware, UnknownAction } from "@reduxjs/toolkit";

// Mock: prevent middlewares from causing side effects
vi.mock("./middleware/loggerMiddleware", () => ({
  loggerMiddleware: (() => (next) => (action) => next(action)) as Middleware,
}));
vi.mock("./middleware/readingStateMiddleware", () => ({
  readingStateMiddleware: (() => (next) => (action) => next(action)) as Middleware,
}));

describe("Store", () => {
  it("should initialize with the correct structure", () => {
    const store = createStore();
    const state = store.getState();

    // Verify that all reducers are correctly combined
    expect(state).toHaveProperty("read");
    expect(state).toHaveProperty("view");
    expect(state).toHaveProperty("sidePane");
    expect(state).toHaveProperty("history");
    expect(state).toHaveProperty("bookCollection");
    expect(state).toHaveProperty("settings");
  });

  it("should apply preloadedState correctly", () => {
    // Note: Partial<RootState> can be deep, but here we only need the top level to be partial
    // since we provide the full slice if we specify it.
    const preloadedState: Partial<RootState> = {
      view: {
        activeView: "bookshelf",
      },
    };

    const store = createStore(preloadedState);
    expect(store.getState().view.activeView).toBe("bookshelf");
    // Verify that other properties maintain their default values
    expect(store.getState().settings.general.log.level).toBe("info");
  });

  it("should have thunk middleware applied", async () => {
    const store = createStore();
    // Verify that dispatch accepts async actions (Thunk is enabled)
    // Cast to UnknownAction to simulate thunk execution
    const result = store.dispatch((dispatch: (action: UnknownAction) => UnknownAction) => {
      return dispatch({ type: "THUNK_TEST" } as UnknownAction);
    });
    expect(result.type).toBe("THUNK_TEST");
  });
});
