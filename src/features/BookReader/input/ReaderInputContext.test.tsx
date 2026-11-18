import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { useRef } from "react";
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
import type { PageMove } from "../hooks/usePageNavigation";
import { setNovelDirection } from "../slice";
import { ReaderInputProvider, useRegisterReaderActions } from "./ReaderInputContext";
import type { PointerPosition, ReaderActions } from "./types";

function Reader({ actions }: { actions: ReaderActions }) {
  const area = useRef<HTMLDivElement>(null);
  useRegisterReaderActions(actions, area);
  return <div ref={area} data-testid="reading-area" />;
}

const makeActions = () => ({
  nextPage: vi.fn<PageMove>(() => true),
  previousPage: vi.fn<PageMove>(() => true),
  firstPage: vi.fn<() => void>(),
  lastPage: vi.fn<() => void>(),
  toggleLoupe: vi.fn<(at?: PointerPosition) => void>(),
});

const renderReader = (preloadedState: RootState = createBasePreloadedState()) => {
  const actions = makeActions();
  const store = createTestStore(preloadedState);
  const Wrapper = createTestWrapper({ store });
  const ui = (readerActions: ReaderActions) => (
    <Wrapper>
      <ReaderInputProvider>
        <Reader actions={readerActions} />
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
    const { unmount, moves, actions } = renderReader();
    unmount();
    // Not prevented: a leftover listener would still claim the bound key.
    expect(fireEvent.keyDown(document.body, { key: "ArrowLeft" })).toBe(true);
    fireEvent.mouseDown(document.body, { button: 1 });
    expect(moves()).toBe(0);
    expect(actions.toggleLoupe).not.toHaveBeenCalled();
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
    const actions = {
      nextPage: vi.fn<PageMove>(() => true),
      previousPage: vi.fn<PageMove>(),
      firstPage: vi.fn<() => void>(),
      lastPage: vi.fn<() => void>(),
    };
    const Wrapper = createTestWrapper({ preloadedState: createBasePreloadedState() });
    const { rerender } = render(
      <Wrapper>
        <ReaderInputProvider>
          <Reader actions={actions} />
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
