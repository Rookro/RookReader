import { fireEvent, screen, waitFor } from "@testing-library/react";
import { type Book, makeBook, type View } from "foliate-js/view.js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readNovelFile } from "../../../bindings/binaryApi";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import { ReaderInputProvider } from "../input/ReaderInputContext";
import NovelReader from "./NovelReader";

vi.mock("foliate-js/view.js", () => ({
  makeBook: vi.fn(),
  View: class View {},
}));

const filePath = "/path/to/novel.epub";

/** The reader inside the input provider that BookReader mounts around it. */
const renderReader = () => {
  const preloadedState = createBasePreloadedState();
  preloadedState.reader = { ...preloadedState.reader, history: [filePath], isNovel: true };
  return renderWithProviders(
    <ReaderInputProvider>
      <NovelReader filePath={filePath} />
    </ReaderInputProvider>,
    { preloadedState },
  );
};

// Clicks on foliate-js's margins bubble out of its shadow roots to the viewer box.
describe("BookReader/NovelReader margins", () => {
  let mockView: Partial<View> & { [key: string]: unknown };
  const originalCreateElement = document.createElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(readNovelFile).mockResolvedValue(new ArrayBuffer(3));
    vi.mocked(makeBook).mockResolvedValue({
      sections: [],
      toc: [],
      destroy: vi.fn(),
      transformTarget: new EventTarget(),
    } as unknown as Book);

    mockView = {
      open: vi.fn(() => Promise.resolve()),
      init: vi.fn(() => Promise.resolve()),
      close: vi.fn(),
      remove: vi.fn(),
      next: vi.fn(),
      prev: vi.fn(),
      lastLocation: { cfi: "initial", section: { current: 0, total: 1 } },
    };

    vi.spyOn(document, "createElement").mockImplementation(function (
      this: Document,
      tagName: string,
      options?: ElementCreationOptions,
    ) {
      const el = originalCreateElement.call(this, tagName, options);
      if (tagName === "foliate-view") {
        Object.assign(el, mockView);
      }
      return el;
    });
  });

  it("turns the page on a click on the margins", async () => {
    renderReader();
    await waitFor(() => expect(mockView.init).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId("novel-viewer"), { clientX: 10 });

    expect(mockView.next).toHaveBeenCalledTimes(1);
  });

  it("goes back on a right-click on the margins", async () => {
    renderReader();
    await waitFor(() => expect(mockView.init).toHaveBeenCalled());

    const notPrevented = fireEvent.contextMenu(screen.getByTestId("novel-viewer"));

    expect(mockView.prev).toHaveBeenCalledTimes(1);
    expect(notPrevented).toBe(false);
  });

  it("ignores a margin click while the book is loading", async () => {
    mockView.lastLocation = undefined;
    mockView.init = vi.fn(() => new Promise<void>(() => {}));
    renderReader();
    await waitFor(() => expect(mockView.init).toHaveBeenCalled());

    fireEvent.click(screen.getByTestId("novel-viewer"), { clientX: 10 });

    expect(mockView.next).not.toHaveBeenCalled();
  });
});
