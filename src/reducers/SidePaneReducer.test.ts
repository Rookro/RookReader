import { describe, it, expect } from "vitest";
import sidePaneReducer, { setIsLeftSidePanelsHidden, setLeftSideTabIndex } from "./SidePaneReducer";

describe("SidePaneReducer", () => {
  const initialState = {
    left: {
      isHidden: false,
      tabIndex: 0,
    },
  };

  // Verify that the initial state is correctly returned
  it("should return the initial state", () => {
    expect(sidePaneReducer(undefined, { type: "unknown" })).toEqual(initialState);
  });

  // Verify that toggling the visibility of the left side panel is handled correctly
  it("should handle setIsLeftSidePanelsHidden", () => {
    const state = sidePaneReducer(initialState, setIsLeftSidePanelsHidden(true));
    expect(state.left.isHidden).toBe(true);

    const state2 = sidePaneReducer(state, setIsLeftSidePanelsHidden(false));
    expect(state2.left.isHidden).toBe(false);
  });

  // Verify that switching the tab index of the left side panel is handled correctly
  it("should handle setLeftSideTabIndex", () => {
    const state = sidePaneReducer(initialState, setLeftSideTabIndex(1));
    expect(state.left.tabIndex).toBe(1);

    const state2 = sidePaneReducer(state, setLeftSideTabIndex(5));
    expect(state2.left.tabIndex).toBe(5);
  });

  // Verify that multiple state updates (visibility setting and tab change) are handled correctly when combined
  it("should handle multiple state updates", () => {
    let state = sidePaneReducer(initialState, setIsLeftSidePanelsHidden(true));
    state = sidePaneReducer(state, setLeftSideTabIndex(2));
    expect(state.left.isHidden).toBe(true);
    expect(state.left.tabIndex).toBe(2);

    state = sidePaneReducer(state, setIsLeftSidePanelsHidden(false));
    expect(state.left.isHidden).toBe(false);
    expect(state.left.tabIndex).toBe(2);
  });
});
