import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { Profiler } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../../../bindings/api";
import { getImage } from "../../../bindings/binaryApi";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import { openBook } from "../slice";
import { wheelGesture } from "../utils/wheelGesture";
import BookReader from "./BookReader";

vi.mock("../../SidePane/components/SideTabs", () => ({
  default: () => <div data-testid="side-tabs" />,
}));
vi.mock("../../SidePane/components/SidePanels", () => ({
  default: ({ isHidden }: { isHidden: boolean }) => (
    <div data-testid="side-panels" inert={isHidden} />
  ),
}));
vi.mock("./ControlSlider", () => ({ default: () => <div data-testid="control-slider" /> }));
vi.mock("./ReaderToolbar", () => ({ default: () => <div data-testid="reader-toolbar" /> }));
vi.mock("./FileNavigator/FileNavigator", () => ({ default: () => <div /> }));
vi.mock("./ImageEntriesViewer/ImageEntriesViewer", () => ({ default: () => <div /> }));
vi.mock("./HistoryViewer/HistoryViewer", () => ({ default: () => <div /> }));
vi.mock("./NovelReader", () => ({ default: () => <div data-testid="novel-reader" /> }));

vi.mock("../../../hooks/useDragDropEvent", () => ({
  useDragDropEvent: vi.fn(),
}));

/** A comic open on its first page, in single-page view. */
const comicOpen = () => {
  const state = createBasePreloadedState();
  state.reader.history = ["/books/a.zip"];
  state.reader.historyIndex = 0;
  state.reader.entries = ["a1", "a2"];
  state.settings.reader.comic.enableSpread = false;
  return state;
};

/** A page as the backend sends it: a 100 x 200 header and one byte of data. */
const pageBuffer = () => {
  const buffer = new ArrayBuffer(9);
  const view = new DataView(buffer);
  view.setUint32(0, 100);
  view.setUint32(4, 200);
  return buffer;
};

/** An open the test finishes itself. */
const heldOpen = () => {
  let finish: (entries: string[]) => void = () => {};
  vi.mocked(api.openBook).mockReturnValueOnce(
    new Promise((resolve) => {
      finish = (entries) =>
        resolve({
          entries,
          isDirectory: false,
          isNovel: false,
          hasPreviews: false,
          book: null,
          recordError: null,
        });
    }),
  );
  return finish;
};

describe("BookReader switching books", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom lays nothing out; the reader measures a zero box and would never load a page.
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 600,
      width: 800,
      height: 600,
      toJSON: () => ({}),
    });
    vi.mocked(getImage).mockResolvedValue(pageBuffer());
    URL.createObjectURL = vi.fn(() => "blob:page");
    URL.revokeObjectURL = vi.fn();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    wheelGesture.reset();
  });

  it("asks for the next book's first page without measuring the reader again", async () => {
    const { store } = renderWithProviders(<BookReader />, { preloadedState: comicOpen() });
    await screen.findByRole("img");
    const finish = heldOpen();

    await act(async () => {
      store.dispatch(openBook({ path: "/books/b.zip", origin: null }));
    });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    await act(async () => {
      finish(["b1", "b2"]);
    });

    await waitFor(() =>
      expect(getImage).toHaveBeenCalledWith("/books/b.zip", "b1", expect.any(Number)),
    );
    expect(api.setDisplaySize).toHaveBeenCalledTimes(1);
  });

  it("never shows the page spinner beside the loading overlay", async () => {
    vi.useFakeTimers();
    vi.mocked(getImage).mockReturnValue(new Promise(() => {}));
    // act() flushes every commit before the test can look, so each is checked as it lands.
    let spinnersAtOnce = 0;
    const probe = () => {
      spinnersAtOnce = Math.max(
        spinnersAtOnce,
        document.querySelectorAll('[role="progressbar"]').length,
      );
    };
    const { store } = renderWithProviders(
      <Profiler id="reader" onRender={probe}>
        <BookReader />
      </Profiler>,
      { preloadedState: comicOpen() },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
    heldOpen();

    await act(async () => {
      store.dispatch(openBook({ path: "/books/b.zip", origin: null }));
    });

    expect(spinnersAtOnce).toBe(1);
  });

  // Guard: the overlay stands in for the reader while the book opens, and holds the wheel
  // gesture so the rest of a spin does not turn pages in the new book
  it("turns no page for a click or a wheel during the open", async () => {
    const { store } = renderWithProviders(<BookReader />, { preloadedState: comicOpen() });
    await screen.findByRole("img");
    const finish = heldOpen();
    await act(async () => {
      store.dispatch(openBook({ path: "/books/b.zip", origin: null }));
    });

    // jsdom stamps events with Date.now(); freeze it so both wheels fall inside
    // WHEEL_GESTURE_GAP_MS however long the load takes: the same spin, continuing over the
    // new book. afterEach's restoreAllMocks restores it.
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValue(now);
    fireEvent.click(screen.getByRole("progressbar"));
    fireEvent.wheel(screen.getByRole("progressbar"), { deltaY: 100 });
    await act(async () => {
      finish(["b1", "b2", "b3"]);
    });
    fireEvent.wheel(screen.getByTestId("comic-reader-area"), { deltaY: 100 });

    expect(store.getState().reader.index).toBe(0);
  });

  // Guard: a novel being replaced is not kept, or it would read the incoming file
  it("does not keep a novel while the next book opens", async () => {
    const state = comicOpen();
    state.reader.isNovel = true;
    const { store } = renderWithProviders(<BookReader />, { preloadedState: state });
    expect(screen.getByTestId("novel-reader")).toBeInTheDocument();
    heldOpen();

    await act(async () => {
      store.dispatch(openBook({ path: "/books/b.zip", origin: null }));
    });

    expect(screen.queryByTestId("novel-reader")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toBeInTheDocument();
  });

  // Guard (Review Focus 1): a failed open leaves an empty reader — no spinner, no page of
  // the previous book, no error in a page's place
  it("shows nothing after the next book fails to open", async () => {
    const { store } = renderWithProviders(<BookReader />, { preloadedState: comicOpen() });
    await screen.findByRole("img");
    vi.mocked(api.openBook).mockRejectedValueOnce(new Error("broken archive"));

    await act(async () => {
      await store.dispatch(openBook({ path: "/books/b.zip", origin: null }));
    });

    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByTestId("page-error-message")).not.toBeInTheDocument();
  });
});
