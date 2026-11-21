import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, onTestFinished, vi } from "vitest";
import { api } from "../../../bindings/api";
import { createMockBookmark, createMockBookWithState } from "../../../test/factories";
import { createReaderActionSpies, TestReader } from "../../../test/readerInput";
import {
  createBasePreloadedState,
  createTestStore,
  createTestWrapper,
  mockSettingsCommands,
  type RootState,
} from "../../../test/utils";
import { updateSettings } from "../../Settings/slice";
import { setNovelDirection } from "../slice";
import { ReaderInputProvider, useReaderInput } from "./ReaderInputContext";
import type { PointerPosition, ReaderActions, ReaderInputApi } from "./types";

const makeActions = () => ({
  ...createReaderActionSpies(),
  toggleLoupe: vi.fn<(at?: PointerPosition) => void>(),
});

const renderReader = (preloadedState: RootState = createBasePreloadedState()) => {
  const actions = makeActions();
  const store = createTestStore(preloadedState);
  const Wrapper = createTestWrapper({ store });
  const ui = (readerActions: ReaderActions) => (
    <Wrapper>
      <ReaderInputProvider>
        <TestReader actions={readerActions} testId="reading-area" />
      </ReaderInputProvider>
    </Wrapper>
  );
  const view = render(ui(actions));
  const moves = () => actions.nextPage.mock.calls.length + actions.previousPage.mock.calls.length;
  /** Re-renders the reader with other actions. */
  const swapActions = (readerActions: ReaderActions) => view.rerender(ui(readerActions));
  return { ...view, store, actions, moves, swapActions };
};

const withView = (activeView: "reader" | "bookshelf") => {
  const preloadedState = createBasePreloadedState();
  preloadedState.view.activeView = activeView;
  return preloadedState;
};

/** A reader view with three books in its history, at `historyIndex`. */
const withHistory = (historyIndex: number) => {
  const preloadedState = createBasePreloadedState();
  preloadedState.reader.history = ["/book/1", "/book/2", "/book/3"];
  preloadedState.reader.historyIndex = historyIndex;
  return preloadedState;
};

// fireEvent has no auxClick.
const auxClick = (button: number) =>
  new MouseEvent("auxclick", { button, bubbles: true, cancelable: true });

describe("ReaderInputProvider", () => {
  it("delivers a key press while the reader view is active", () => {
    const { moves } = renderReader(withView("reader"));
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(moves()).toBe(1);
  });

  it("ignores every key press while the bookshelf view is active", () => {
    const { moves } = renderReader(withView("bookshelf"));
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });
    expect(moves()).toBe(0);
  });

  it("ignores a key press typed into a text field", () => {
    const { moves } = renderReader();
    const input = document.createElement("input");
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: "ArrowLeft" });
    expect(moves()).toBe(0);
    input.remove();
  });

  // A key pressed in a dialog belongs to the dialog, not to the page behind it
  it("ignores a key press inside a dialog", () => {
    const { moves } = renderReader();
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    const button = document.createElement("button");
    dialog.appendChild(button);
    document.body.appendChild(dialog);
    fireEvent.keyDown(button, { key: "ArrowLeft" });
    expect(moves()).toBe(0);
    dialog.remove();
  });

  it("stops listening once the provider unmounts", () => {
    const { unmount, moves, actions, store } = renderReader(withHistory(1));
    unmount();
    // Not prevented: a leftover listener would still claim the bound key or button.
    expect(fireEvent.keyDown(document.body, { key: "ArrowLeft" })).toBe(true);
    fireEvent.mouseDown(document.body, { button: 1 });
    expect(fireEvent.mouseDown(document.body, { button: 3 })).toBe(true);
    expect(fireEvent.mouseUp(document.body, { button: 3 })).toBe(true);
    expect(fireEvent(document.body, auxClick(3))).toBe(true);
    expect(moves()).toBe(0);
    expect(actions.toggleLoupe).not.toHaveBeenCalled();
    expect(store.getState().reader.historyIndex).toBe(1);
  });

  it("ignores the loupe button while the bookshelf view is active", () => {
    const { actions, getByTestId } = renderReader(withView("bookshelf"));
    fireEvent.mouseDown(getByTestId("reading-area"), { button: 1 });
    expect(actions.toggleLoupe).not.toHaveBeenCalled();
  });

  it("follows a direction that changes after mount", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.isNovel = true;
    preloadedState.reader.novelDirection = "ltr";
    const { actions, store } = renderReader(preloadedState);

    act(() => {
      store.dispatch(setNovelDirection("rtl"));
    });
    fireEvent.keyDown(document.body, { key: "ArrowLeft" });

    expect(actions.nextPage).toHaveBeenCalledTimes(1);
    expect(actions.previousPage).not.toHaveBeenCalled();
  });

  it("uses the reader's latest actions without re-registering", () => {
    const { actions, swapActions } = renderReader();
    const latest = makeActions();
    swapActions(latest);

    fireEvent.keyDown(document.body, { key: "ArrowLeft" });

    expect(latest.nextPage).toHaveBeenCalledTimes(1);
    expect(actions.nextPage).not.toHaveBeenCalled();
  });

  it.each([
    ["rtl", "nextPage"],
    ["ltr", "previousPage"],
  ] as const)(
    "pages a novel by its own direction, not the comic setting (%s)",
    (direction, expected) => {
      const preloadedState = createBasePreloadedState();
      preloadedState.reader.isNovel = true;
      preloadedState.reader.novelDirection = direction;
      // The opposite comic setting must not reach the novel.
      preloadedState.settings.reader.comic.readingDirection = direction === "rtl" ? "ltr" : "rtl";
      const { actions } = renderReader(preloadedState);

      fireEvent.keyDown(document.body, { key: "ArrowLeft" });

      expect(actions[expected]).toHaveBeenCalledTimes(1);
    },
  );

  it("toggles the loupe with its button over the reading area, at the pointer", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.loupe.toggleKey = "MouseMiddle";
    const { actions, getByTestId } = renderReader(preloadedState);

    fireEvent.mouseDown(getByTestId("reading-area"), { button: 1, clientX: 10, clientY: 20 });

    expect(actions.toggleLoupe).toHaveBeenCalledWith({ clientX: 10, clientY: 20 });
  });

  it("does not toggle the loupe with its button outside the reading area", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.loupe.toggleKey = "MouseMiddle";
    const { actions } = renderReader(preloadedState);

    fireEvent.mouseDown(document.body, { button: 1 });

    expect(actions.toggleLoupe).not.toHaveBeenCalled();
  });

  it("stops delivering to a reader once it unmounts", () => {
    const actions = createReaderActionSpies();
    const Wrapper = createTestWrapper({ preloadedState: createBasePreloadedState() });
    const { rerender } = render(
      <Wrapper>
        <ReaderInputProvider>
          <TestReader actions={actions} />
        </ReaderInputProvider>
      </Wrapper>,
    );
    rerender(
      <Wrapper>
        <ReaderInputProvider>{null}</ReaderInputProvider>
      </Wrapper>,
    );

    fireEvent.keyDown(document.body, { key: "ArrowLeft" });

    expect(actions.nextPage).not.toHaveBeenCalled();
  });
});

describe("ReaderInputProvider: common actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  it("shows and hides the side pane with P", () => {
    const { store } = renderReader();

    fireEvent.keyDown(document.body, { key: "p" });
    expect(store.getState().settings.layout.sidePane.isHidden).toBe(true);

    fireEvent.keyDown(document.body, { key: "p" });
    expect(store.getState().settings.layout.sidePane.isHidden).toBe(false);
  });

  it("adds a bookmark with B, then removes it with B", async () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.book = createMockBookWithState({ id: 42 });
    preloadedState.reader.index = 3;
    preloadedState.reader.entries = ["p1", "p2", "p3", "p4"];
    preloadedState.bookmark = { bookId: 42, bookmarks: [], status: "succeeded" };
    vi.mocked(api.createBookmark).mockResolvedValue(
      createMockBookmark({ id: 1, bookId: 42, pageIndex: 3, cfi: null }),
    );
    const { store } = renderReader(preloadedState);

    fireEvent.keyDown(document.body, { key: "b" });
    await waitFor(() => expect(store.getState().bookmark.bookmarks).toHaveLength(1));
    expect(api.createBookmark).toHaveBeenCalledWith(42, "Page 4", 3, null);

    fireEvent.keyDown(document.body, { key: "b" });
    await waitFor(() => expect(store.getState().bookmark.bookmarks).toHaveLength(0));
    expect(api.deleteBookmark).toHaveBeenCalledWith(1);
  });

  it("toggles the loupe, not the side pane, when the loupe key is P", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.reader.comic.loupe.toggleKey = "P";
    const { actions, store } = renderReader(preloadedState);

    fireEvent.keyDown(document.body, { key: "p" });

    expect(actions.toggleLoupe).toHaveBeenCalledTimes(1);
    expect(store.getState().settings.layout.sidePane.isHidden).toBe(false);
  });

  // Space on a focused toolbar button turns the page instead of pressing the button.
  it("turns the page with Space on a focused button and claims the key", () => {
    const { actions } = renderReader();
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    const event = new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true });

    fireEvent(button, event);

    expect(actions.nextPage).toHaveBeenCalledTimes(1);
    expect(actions.nextPage).toHaveBeenCalledWith();
    expect(event.defaultPrevented).toBe(true);
    button.remove();
  });
});

describe("ReaderInputProvider: side pane", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSettingsCommands();
  });

  const appendPaneButton = () => {
    const pane = document.createElement("div");
    pane.setAttribute("data-side-pane", "");
    const button = document.createElement("button");
    pane.appendChild(button);
    document.body.appendChild(pane);
    onTestFinished(() => pane.remove());
    return button;
  };

  it("shows a hidden pane with F6 from its tab strip", () => {
    const preloadedState = createBasePreloadedState();
    preloadedState.settings.layout.sidePane.isHidden = true;
    const { store } = renderReader(preloadedState);

    fireEvent.keyDown(appendPaneButton(), { key: "F6" });

    expect(store.getState().settings.layout.sidePane.isHidden).toBe(false);
  });

  it("keeps a key on the body from the reader once the keyboard is in the pane", () => {
    const { moves } = renderReader();

    fireEvent.keyDown(appendPaneButton(), { key: "ArrowDown" });
    expect(fireEvent.keyDown(document.body, { key: "ArrowDown" })).toBe(false);

    expect(moves()).toBe(0);
  });
});

describe("ReaderInputProvider: mouse side buttons", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    { button: 3, expected: 0, path: "/book/1" },
    { button: 4, expected: 2, path: "/book/3" },
  ])("steps through the book history with button $button", async ({ button, expected, path }) => {
    const { store } = renderReader(withHistory(1));

    expect(fireEvent.mouseDown(document.body, { button })).toBe(false);

    expect(store.getState().reader.historyIndex).toBe(expected);
    await waitFor(() => expect(api.openBook).toHaveBeenCalledWith(path));
  });

  // The webview's own navigation must not run at the end of the history either.
  it("claims the back button at the start of the history", () => {
    const { store } = renderReader(withHistory(0));

    expect(fireEvent.mouseDown(document.body, { button: 3 })).toBe(false);

    expect(store.getState().reader.historyIndex).toBe(0);
    expect(api.openBook).not.toHaveBeenCalled();
  });

  it.each([3, 4])("prevents the release of button %i and does nothing else", (button) => {
    const { store, moves } = renderReader(withHistory(1));

    expect(fireEvent.mouseUp(document.body, { button })).toBe(false);
    expect(fireEvent(document.body, auxClick(button))).toBe(false);

    expect(store.getState().reader.historyIndex).toBe(1);
    expect(moves()).toBe(0);
  });

  it("leaves the release of other buttons alone", () => {
    renderReader(withHistory(1));

    expect(fireEvent.mouseUp(document.body, { button: 1 })).toBe(true);
    expect(fireEvent(document.body, auxClick(1))).toBe(true);
  });

  it("toggles only the loupe when its button is MouseBack, over the reading area", () => {
    const preloadedState = withHistory(1);
    preloadedState.settings.reader.comic.loupe.toggleKey = "MouseBack";
    const { actions, store, getByTestId } = renderReader(preloadedState);

    fireEvent.mouseDown(getByTestId("reading-area"), { button: 3 });

    expect(actions.toggleLoupe).toHaveBeenCalledTimes(1);
    expect(store.getState().reader.historyIndex).toBe(1);
  });

  it("goes back in the history when the loupe's MouseBack is pressed outside the reading area", () => {
    const preloadedState = withHistory(1);
    preloadedState.settings.reader.comic.loupe.toggleKey = "MouseBack";
    const { actions, store } = renderReader(preloadedState);

    fireEvent.mouseDown(document.body, { button: 3 });

    expect(actions.toggleLoupe).not.toHaveBeenCalled();
    expect(store.getState().reader.historyIndex).toBe(0);
  });

  it("ignores the side buttons while a dialog is open", () => {
    const { store } = renderReader(withHistory(1));
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    document.body.appendChild(dialog);

    expect(fireEvent.mouseDown(dialog, { button: 3 })).toBe(true);
    // The webview's own history navigation is still stopped.
    expect(fireEvent.mouseUp(dialog, { button: 3, cancelable: true })).toBe(false);

    expect(store.getState().reader.historyIndex).toBe(1);
    dialog.remove();
  });

  // Only keys are typed into a field; a side button over the path input still goes back.
  it("goes back in the history with a side button over a text field", () => {
    const { store } = renderReader(withHistory(1));
    const input = document.createElement("input");
    document.body.appendChild(input);

    fireEvent.mouseDown(input, { button: 3 });

    expect(store.getState().reader.historyIndex).toBe(0);
    input.remove();
  });

  it("ignores the side buttons while the bookshelf view is active", () => {
    const preloadedState = withHistory(1);
    preloadedState.view.activeView = "bookshelf";
    const { store } = renderReader(preloadedState);

    expect(fireEvent.mouseDown(document.body, { button: 3 })).toBe(true);
    expect(fireEvent.mouseUp(document.body, { button: 3 })).toBe(true);

    expect(store.getState().reader.historyIndex).toBe(1);
  });
});

let dispatchInput: ReaderInputApi["dispatchInput"];

/** Hands the provider's dispatcher to the test, as the reading area's receivers get it. */
const ClickProbe = () => {
  dispatchInput = useReaderInput().dispatchInput;
  return null;
};

describe("ReaderInputProvider: clicks", () => {
  /** A novel read in `direction` with the given click mode, in a 100px-wide reading area. */
  const renderClicks = (clickToTurnPages: "anywhere" | "bySide", direction: "ltr" | "rtl") => {
    const preloadedState = createBasePreloadedState();
    preloadedState.reader.isNovel = true;
    preloadedState.reader.novelDirection = direction;
    preloadedState.settings.reader.clickToTurnPages = clickToTurnPages;
    const actions = makeActions();
    const store = createTestStore(preloadedState);
    const Wrapper = createTestWrapper({ store });
    const view = render(
      <Wrapper>
        <ReaderInputProvider>
          <TestReader actions={actions} testId="reading-area" />
          <ClickProbe />
        </ReaderInputProvider>
      </Wrapper>,
    );
    vi.spyOn(view.getByTestId("reading-area"), "getBoundingClientRect").mockReturnValue({
      left: 0,
      width: 100,
    } as DOMRect);
    return { store, actions };
  };

  const clickAt = (clientX: number, button: "left" | "right" = "left") => {
    act(() => {
      dispatchInput({ kind: "click", button, at: { clientX, clientY: 0 } });
    });
  };

  it("turns a left click by the half of the reading area it lands in", () => {
    const { actions } = renderClicks("bySide", "rtl");

    clickAt(20);
    expect(actions.nextPage).toHaveBeenCalledTimes(1);
    expect(actions.previousPage).not.toHaveBeenCalled();

    clickAt(80);
    expect(actions.previousPage).toHaveBeenCalledTimes(1);
    expect(actions.nextPage).toHaveBeenCalledTimes(1);
  });

  it("flips the halves when the direction changes while reading", () => {
    const { actions, store } = renderClicks("bySide", "rtl");

    act(() => {
      store.dispatch(setNovelDirection("ltr"));
    });
    clickAt(20);

    expect(actions.previousPage).toHaveBeenCalledTimes(1);
    expect(actions.nextPage).not.toHaveBeenCalled();
  });

  it("applies a mode changed while reading", async () => {
    mockSettingsCommands();
    const { actions, store } = renderClicks("anywhere", "rtl");

    clickAt(80);
    expect(actions.nextPage).toHaveBeenCalledTimes(1);

    await act(async () => {
      await store.dispatch(
        updateSettings({ key: "reader", value: { clickToTurnPages: "bySide" } }),
      );
    });
    clickAt(80);

    expect(actions.previousPage).toHaveBeenCalledTimes(1);
    expect(actions.nextPage).toHaveBeenCalledTimes(1);
  });
});
