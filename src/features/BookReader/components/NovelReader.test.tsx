import * as fs from "@tauri-apps/plugin-fs";
import { act, screen, waitFor } from "@testing-library/react";
import { makeBook } from "foliate-js/view.js";
import type { Mock } from "vitest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockLog, mockStore } from "../../../test/mocks/tauri";
import { createBasePreloadedState, renderWithProviders } from "../../../test/utils";
import * as pageNav from "../hooks/usePageNavigation";
import * as ReadReducer from "../slice";
import NovelReader from "./NovelReader";

// Mock foliate-js/view.js
vi.mock("foliate-js/view.js", () => ({
  makeBook: vi.fn(),
  View: class View {},
}));

import type { Book, View } from "foliate-js/view.js";

const mockBook = {
  toc: [{ label: "Chapter 1", href: "ch1.html" }],
  sections: [{ id: "section0" }],
  resolveHref: vi.fn().mockImplementation((href) => {
    if (href === "ch1.html") return { index: 0, anchor: vi.fn() };
    return null;
  }),
  destroy: vi.fn(),
} as unknown as Book;

const mockPageNavHandlers = {
  handleClicked: vi.fn(),
  handleContextMenu: vi.fn(),
  handleWheeled: vi.fn(),
  handleKeydown: vi.fn(),
};

vi.mock("../hooks/usePageNavigation", () => ({
  usePageNavigation: vi.fn(() => mockPageNavHandlers),
}));

vi.mock("../slice", async () => {
  const actual = await vi.importActual("../slice");
  return {
    ...actual,
    setEntries: vi.fn((payload: string[]) => ({ type: "read/setEntries", payload })),
    setNovelLocation: vi.fn((payload: { index: number; cfi: string }) => ({
      type: "read/setNovelLocation",
      payload,
    })),
  };
});

describe("BookReader/NovelReader", () => {
  const mockFilePath = "/path/to/novel.epub";
  const defaultPreloadedState = createBasePreloadedState();
  defaultPreloadedState.read.containerFile = {
    ...defaultPreloadedState.read.containerFile,
    history: [mockFilePath],
    historyIndex: 0,
    index: 0,
    cfi: null,
    isNovel: true,
  };

  let mockView: Partial<View> & { [key: string]: unknown };
  const originalCreateElement = document.createElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.get.mockResolvedValue(null);
    vi.mocked(fs.readFile).mockResolvedValue(new Uint8Array([1, 2, 3]));
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    mockView = {
      style: {} as CSSStyleDeclaration,
      open: vi.fn(() => Promise.resolve()),
      init: vi.fn(() => Promise.resolve()),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      close: vi.fn(),
      remove: vi.fn(),
      goTo: vi.fn(() => Promise.resolve()),
      next: vi.fn(),
      prev: vi.fn(),
      lastLocation: { index: -1, cfi: "initial" },
      renderer: { setStyles: vi.fn() } as unknown as HTMLElement,
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

  it("should load the EPUB file and initialize foliate-js", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    expect(fs.readFile).toHaveBeenCalledWith(mockFilePath);
    await waitFor(() => expect(mockView.open).toHaveBeenCalledWith(mockBook));
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("should handle cleanup when filePath changes", async () => {
    const { rerender } = renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(makeBook).toHaveBeenCalled());

    rerender(<NovelReader filePath="/new/path.epub" />);
    expect(mockView.close).toHaveBeenCalled();
    expect(mockView.remove).toHaveBeenCalled();
  });

  it("should dispatch entries when book is loaded", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(ReadReducer.setEntries).toHaveBeenCalledWith(["Chapter 1"]));
  });

  it("should log error when readFile fails", async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error("Disk error"));
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() =>
      expect(mockLog.error).toHaveBeenCalledWith(
        expect.stringContaining("Error loading EPUB file: Error: Disk error"),
      ),
    );
  });

  it("should handle relocate events", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(makeBook).toHaveBeenCalled());

    const relocateCall = (mockView.addEventListener as Mock).mock.calls.find(
      (call: unknown[]) => call[0] === "relocate",
    );
    const relocateHandler = relocateCall?.[1];

    if (typeof relocateHandler === "function") {
      act(() => {
        relocateHandler({ detail: { section: { current: 5, total: 10 }, cfi: "epubcfi(5)" } });
      });
    }

    expect(ReadReducer.setNovelLocation).toHaveBeenCalledWith({ index: 5, cfi: "epubcfi(5)" });
  });

  it("should display specific cfi if provided in state", async () => {
    const cfiState = {
      ...defaultPreloadedState,
      read: {
        ...defaultPreloadedState.read,
        containerFile: { ...defaultPreloadedState.read.containerFile, cfi: "epubcfi(target)" },
      },
    };

    renderWithProviders(<NovelReader filePath={mockFilePath} />, { preloadedState: cfiState });
    await waitFor(() => expect(makeBook).toHaveBeenCalled());

    // Initially init should be called with the cfi
    await waitFor(() =>
      expect(mockView.init).toHaveBeenCalledWith({ lastLocation: "epubcfi(target)" }),
    );
  });

  it("should register content load hooks and handle events", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(makeBook).toHaveBeenCalled());

    const loadCall = (mockView.addEventListener as Mock).mock.calls.find(
      (call: unknown[]) => call[0] === "load",
    );
    const loadHandler = loadCall?.[1];

    if (typeof loadHandler === "function") {
      const mockDoc = {
        addEventListener: vi.fn(),
        createElement: originalCreateElement,
        head: { appendChild: vi.fn() },
        body: {},
      } as unknown as Document;

      Object.defineProperty(mockDoc, "defaultView", {
        value: {
          getComputedStyle: vi.fn(() => ({
            writingMode: "horizontal-tb",
            includes: (val: string) => "horizontal-tb".includes(val),
          })),
        },
      });

      loadHandler({ detail: { doc: mockDoc } });

      expect(mockDoc.addEventListener).toHaveBeenCalledWith("click", expect.any(Function));
      expect(mockDoc.addEventListener).toHaveBeenCalledWith("contextmenu", expect.any(Function));
      expect(mockDoc.addEventListener).toHaveBeenCalledWith("wheel", expect.any(Function));
      expect(mockDoc.addEventListener).toHaveBeenCalledWith("keydown", expect.any(Function));

      // Test click event
      const clickCall = (mockDoc.addEventListener as Mock).mock.calls.find(
        (call) => call[0] === "click",
      );
      const clickHandler = clickCall?.[1];
      if (typeof clickHandler === "function") {
        const mockEvent = { target: document.createElement("div") } as unknown as MouseEvent;
        clickHandler(mockEvent);
        expect(mockPageNavHandlers.handleClicked).toHaveBeenCalledWith(mockEvent);
      }

      // Test contextmenu
      const contextCall = (mockDoc.addEventListener as Mock).mock.calls.find(
        (call) => call[0] === "contextmenu",
      );
      const contextHandler = contextCall?.[1];
      if (typeof contextHandler === "function") {
        const mockEvent = { preventDefault: vi.fn() } as unknown as MouseEvent;
        contextHandler(mockEvent);
        expect(mockPageNavHandlers.handleContextMenu).toHaveBeenCalledWith(mockEvent);
      }

      // Test wheel
      const wheelCall = (mockDoc.addEventListener as Mock).mock.calls.find(
        (call) => call[0] === "wheel",
      );
      const wheelHandler = wheelCall?.[1];
      if (typeof wheelHandler === "function") {
        const mockEvent = { deltaY: 100 } as WheelEvent;
        wheelHandler(mockEvent);
        expect(mockPageNavHandlers.handleWheeled).toHaveBeenCalledWith(mockEvent);
      }

      // Test keydown
      const keydownCall = (mockDoc.addEventListener as Mock).mock.calls.find(
        (call) => call[0] === "keydown",
      );
      const keydownHandler = keydownCall?.[1];
      if (typeof keydownHandler === "function") {
        const mockEvent = { key: "ArrowRight" } as KeyboardEvent;
        keydownHandler(mockEvent);
        expect(mockPageNavHandlers.handleKeydown).toHaveBeenCalledWith(mockEvent);
      }
    }
  });

  it("should move forward and backward", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(makeBook).toHaveBeenCalled());

    const pageNavCall = vi.mocked(pageNav.usePageNavigation).mock.calls[0];
    const forward = pageNavCall[0];
    const back = pageNavCall[1];

    forward();
    expect(mockView.next).toHaveBeenCalled();

    back();
    expect(mockView.prev).toHaveBeenCalled();
  });
});
