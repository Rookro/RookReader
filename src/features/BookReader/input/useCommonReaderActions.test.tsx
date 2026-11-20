import { act, renderHook, waitFor } from "@testing-library/react";
import type React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../bindings/api";
import { createMockBookmark, createMockBookWithState } from "../../../test/factories";
import {
  createBasePreloadedState,
  createTestStore,
  createTestWrapper,
  mockSettingsCommands,
  type RootState,
} from "../../../test/utils";
import { SidePaneFocusProvider } from "../../SidePane/SidePaneFocusContext";
import { useCommonReaderActions } from "./useCommonReaderActions";

const renderActions = (preloadedState: RootState) => {
  const store = createTestStore(preloadedState);
  const dispatch = vi.spyOn(store, "dispatch");
  const { result } = renderHook(() => useCommonReaderActions(), {
    wrapper: createTestWrapper({ store }),
  });
  return { store, dispatch, actions: result.current };
};

/** Renders the actions under a side pane of three panels, starting at `sidePane`. */
const renderPaneActions = (sidePane: RootState["settings"]["layout"]["sidePane"]) => {
  const preloadedState = createBasePreloadedState();
  preloadedState.settings.layout.sidePane = sidePane;
  const store = createTestStore(preloadedState);
  const Wrapper = createTestWrapper({ store });
  const { result } = renderHook(() => useCommonReaderActions(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <Wrapper>
        <SidePaneFocusProvider tabCount={3}>{children}</SidePaneFocusProvider>
      </Wrapper>
    ),
  });
  return { store, actions: result.current };
};

/** A comic open at page index 3, with its (empty) bookmark list loaded. */
const stateWithOpenBook = () => {
  const preloadedState = createBasePreloadedState();
  preloadedState.reader.book = createMockBookWithState({ id: 42 });
  preloadedState.reader.index = 3;
  preloadedState.reader.entries = ["p1", "p2", "p3", "p4"];
  preloadedState.bookmark = { bookId: 42, bookmarks: [], status: "succeeded" };
  return preloadedState;
};

describe("useCommonReaderActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("toggles the spread, shifts it and flips the direction in a comic", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.enableSpread = true;
    preloadedState.settings.reader.comic.readingDirection = "rtl";
    const { store, actions } = renderActions(preloadedState);

    act(() => {
      actions.shiftSpread();
      actions.toggleDirection();
      actions.toggleSpread();
    });

    expect(store.getState().reader.isSpreadShifted).toBe(true);
    expect(store.getState().reader.readingDirection).toBe("ltr");
    await waitFor(() => expect(store.getState().settings.reader.comic.enableSpread).toBe(false));
  });

  it.each(["toggleSpread", "shiftSpread", "toggleDirection"] as const)(
    "does nothing for %s in an EPUB",
    (action) => {
      const preloadedState = createBasePreloadedState();
      preloadedState.reader.isNovel = true;
      preloadedState.settings.reader.comic.enableSpread = true;
      const { dispatch, actions } = renderActions(preloadedState);

      actions[action]();

      expect(dispatch).not.toHaveBeenCalled();
    },
  );

  it("does not shift the spread while the spread is off", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.enableSpread = false;
    const { store, dispatch, actions } = renderActions(preloadedState);

    actions.shiftSpread();

    expect(dispatch).not.toHaveBeenCalled();
    expect(store.getState().reader.isSpreadShifted).toBe(false);
  });

  it("adds a bookmark at the current page", async () => {
    vi.mocked(api.createBookmark).mockResolvedValue(
      createMockBookmark({ id: 1, bookId: 42, pageIndex: 3 }),
    );
    const { actions } = renderActions(stateWithOpenBook());

    act(() => actions.toggleBookmark());

    await waitFor(() => expect(api.createBookmark).toHaveBeenCalledWith(42, "Page 4", 3, null));
  });

  // A key press has no disabled button in front of it; the toggle itself must wait for the list.
  it.each([
    ["the list is still loading", { bookId: 42, status: "loading" }],
    ["the list belongs to another book", { bookId: 7, status: "succeeded" }],
  ] as const)("does not touch bookmarks while %s", (_case, list) => {
    const preloadedState = stateWithOpenBook();
    preloadedState.bookmark = {
      ...list,
      bookmarks: [createMockBookmark({ id: 1, bookId: list.bookId, pageIndex: 3, cfi: null })],
    };
    const { dispatch, actions } = renderActions(preloadedState);

    actions.toggleBookmark();

    expect(dispatch).not.toHaveBeenCalled();
    expect(api.createBookmark).not.toHaveBeenCalled();
    expect(api.deleteBookmark).not.toHaveBeenCalled();
  });

  it("shows and hides the side pane on its current tab", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.layout.sidePane = { isHidden: false, tabIndex: 2 };
    const { store, actions } = renderActions(preloadedState);

    act(() => actions.toggleSidePane());

    expect(store.getState().settings.layout.sidePane).toEqual({ isHidden: true, tabIndex: 2 });
  });
});

describe("useCommonReaderActions: side pane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("shows a hidden pane on its current tab with focusSidePane", () => {
    const { store, actions } = renderPaneActions({ isHidden: true, tabIndex: 1 });

    act(() => actions.focusSidePane());

    expect(store.getState().settings.layout.sidePane).toEqual({ isHidden: false, tabIndex: 1 });
  });

  it("blurs the pane's focused element with focusReader", () => {
    const { actions } = renderPaneActions({ isHidden: false, tabIndex: 0 });
    const pane = document.createElement("div");
    pane.setAttribute("data-side-pane", "");
    const button = document.createElement("button");
    pane.appendChild(button);
    document.body.appendChild(pane);
    button.focus();

    act(() => actions.focusReader());

    expect(document.activeElement).toBe(document.body);
    pane.remove();
  });

  it.each([
    { action: "nextSidePanel", from: 2, to: 0 },
    { action: "previousSidePanel", from: 0, to: 2 },
  ] as const)("$action moves from panel $from to $to", ({ action, from, to }) => {
    const { store, actions } = renderPaneActions({ isHidden: false, tabIndex: from });

    act(() => actions[action]());

    expect(store.getState().settings.layout.sidePane).toEqual({ isHidden: false, tabIndex: to });
  });
});
