import { describe, expect, it } from "vitest";
import viewReducer, { setActiveView } from "./slice";

describe("ViewReducer", () => {
  const initialState = {
    activeView: "reader" as const,
  };

  // Verify that switching between different views (reader, bookshelf, etc.) is handled correctly
  it("should handle setActiveView", () => {
    const nextState = viewReducer(initialState, setActiveView("bookshelf"));
    expect(nextState.activeView).toBe("bookshelf");
  });
});
