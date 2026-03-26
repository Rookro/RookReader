import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import { screen, waitFor, act } from "@testing-library/react";
import { createBasePreloadedState, renderWithProviders } from "../../test/utils";
import NovelReader from "./NovelReader";
import * as fs from "@tauri-apps/plugin-fs";
import ePub from "epubjs";
import { mockStore, mockLog } from "../../test/mocks/tauri";
import * as ReadReducer from "../../reducers/ReadReducer";
import * as pageNav from "../../hooks/usePageNavigation";

// Mock epubjs types for easier testing
interface MockRendition {
  themes: { default: Mock<() => void> };
  hooks: {
    content: {
      register: Mock<
        (callback: (contents: { document: Document; window: Window }) => void) => void
      >;
    };
  };
  on: Mock<
    (event: string, callback: (location: { start: { index: number; cfi: string } }) => void) => void
  >;
  display: Mock<(target: string | number) => Promise<void>>;
  destroy: Mock<() => void>;
  resize: Mock<(width: number, height: number) => void>;
  location: { start: { index: number; cfi: string } };
  next: Mock<() => void>;
  prev: Mock<() => void>;
}

interface MockBook {
  renderTo: Mock<(element: HTMLElement, options: Record<string, unknown>) => MockRendition>;
  loaded: {
    spine: Promise<{ items: { href: string; idref: string; index: number }[] }>;
    navigation: Promise<{ toc: { label: string; href: string }[] }>;
  };
  destroy: Mock<() => void>;
}

// Mock epubjs
vi.mock("epubjs", () => ({
  default: vi.fn(() => ({
    renderTo: vi.fn(() => ({
      themes: { default: vi.fn() },
      hooks: { content: { register: vi.fn() } },
      on: vi.fn(),
      display: vi.fn(() => Promise.resolve()),
      destroy: vi.fn(),
      resize: vi.fn(),
      next: vi.fn(),
      prev: vi.fn(),
      location: { start: { index: -1, cfi: "initial" } },
    })),
    loaded: {
      spine: Promise.resolve({ items: [{ href: "ch1.html", idref: "ch1", index: 0 }] }),
      navigation: Promise.resolve({ toc: [{ label: "Chapter 1", href: "ch1.html" }] }),
    },
    destroy: vi.fn(),
  })),
}));

const mockPageNavHandlers = {
  handleClicked: vi.fn(),
  handleContextMenu: vi.fn(),
  handleWheeled: vi.fn(),
  handleKeydown: vi.fn(),
};

vi.mock("../../hooks/usePageNavigation", () => ({
  usePageNavigation: vi.fn(() => mockPageNavHandlers),
}));

vi.mock("../../reducers/ReadReducer", async () => {
  const actual = await vi.importActual("../../reducers/ReadReducer");
  return {
    ...actual,
    setEntries: vi.fn((payload: string[]) => ({ type: "read/setEntries", payload })),
    setNovelLocation: vi.fn((payload: { index: number; cfi: string }) => ({
      type: "read/setNovelLocation",
      payload,
    })),
  };
});

// Mock ResizeObserver
let resizeCallback: ResizeObserverCallback | undefined;
class MockResizeObserver {
  constructor(cb: ResizeObserverCallback) {
    resizeCallback = cb;
  }
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}
global.ResizeObserver = MockResizeObserver as typeof ResizeObserver;

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

  beforeEach(() => {
    vi.clearAllMocks();
    mockStore.get.mockResolvedValue(null);
    vi.mocked(fs.readFile).mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  it("should load the EPUB file and initialize ePubjs", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    expect(fs.readFile).toHaveBeenCalledWith(mockFilePath);
    await waitFor(() => expect(ePub).toHaveBeenCalled());
    expect(screen.getByText("Beta")).toBeTruthy();
  });

  it("should handle cleanup when filePath changes", async () => {
    const { rerender } = renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(ePub).toHaveBeenCalled());
    const mockBook = vi.mocked(ePub).mock.results[0].value as MockBook;
    const mockRendition = mockBook.renderTo.mock.results[0].value;

    rerender(<NovelReader filePath="/new/path.epub" />);
    expect(mockRendition.destroy).toHaveBeenCalled();
    expect(mockBook.destroy).toHaveBeenCalled();
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

  it("should handle relocation events", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(ePub).toHaveBeenCalled());
    const mockBook = vi.mocked(ePub).mock.results[0].value as MockBook;
    const mockRendition = mockBook.renderTo.mock.results[0].value;

    const relocatedCall = mockRendition.on.mock.calls.find(
      (call: [string, (location: { start: { index: number; cfi: string } }) => void]) =>
        call[0] === "relocated",
    );
    const relocatedHandler = relocatedCall?.[1];

    if (typeof relocatedHandler === "function") {
      act(() => {
        relocatedHandler({ start: { index: 5, cfi: "epubcfi(5)" } });
      });
    }

    expect(ReadReducer.setNovelLocation).toHaveBeenCalledWith({ index: 5, cfi: "epubcfi(5)" });
  });

  it("should handle resize events", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(ePub).toHaveBeenCalled());
    const mockBook = vi.mocked(ePub).mock.results[0].value as MockBook;
    const mockRendition = mockBook.renderTo.mock.results[0].value;

    act(() => {
      if (resizeCallback) {
        resizeCallback(
          [
            {
              contentBoxSize: [{ inlineSize: 800, blockSize: 600 }],
              borderBoxSize: [{ inlineSize: 800, blockSize: 600 }],
              contentRect: new DOMRectReadOnly(0, 0, 800, 600),
              devicePixelContentBoxSize: [{ inlineSize: 800, blockSize: 600 }],
              target: {} as Element,
            },
          ],
          {} as ResizeObserver,
        );
      }
    });

    expect(mockRendition.resize).toHaveBeenCalledWith(800, 600);
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
    await waitFor(() => expect(ePub).toHaveBeenCalled());
    const mockBook = vi.mocked(ePub).mock.results[0].value as MockBook;
    const mockRendition = mockBook.renderTo.mock.results[0].value;

    await waitFor(() => expect(mockRendition.display).toHaveBeenCalledWith("epubcfi(target)"));
  });

  it("should register content hooks and handle events", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(ePub).toHaveBeenCalled());
    const mockBook = vi.mocked(ePub).mock.results[0].value as MockBook;
    const mockRendition = mockBook.renderTo.mock.results[0].value;

    const registerCall = mockRendition.hooks.content.register.mock.calls[0];
    const hookCallback = registerCall?.[0];

    if (typeof hookCallback === "function") {
      const mockDoc = {
        addEventListener: vi.fn(),
        body: { getComputedStyle: vi.fn(() => ({ writingMode: "horizontal-tb" })) },
      } as unknown as Document;
      const mockWindow = {
        getComputedStyle: vi.fn(() => ({ writingMode: "horizontal-tb" })),
      } as unknown as Window;

      hookCallback({ document: mockDoc, window: mockWindow });

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

  it("should apply Linux specific styles when Linux user agent is detected", async () => {
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36",
      configurable: true,
    });

    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(ePub).toHaveBeenCalled());
    const mockBook = vi.mocked(ePub).mock.results[0].value as MockBook;
    const mockRendition = mockBook.renderTo.mock.results[0].value;

    expect(mockRendition.themes.default).toHaveBeenCalledWith(
      expect.objectContaining({
        ".vrtl": expect.objectContaining({ "font-feature-settings": '"vert"' }),
      }),
    );

    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it("should move forward and backward", async () => {
    renderWithProviders(<NovelReader filePath={mockFilePath} />, {
      preloadedState: defaultPreloadedState,
    });
    await waitFor(() => expect(ePub).toHaveBeenCalled());
    const mockBook = vi.mocked(ePub).mock.results[0].value as MockBook;
    const mockRendition = mockBook.renderTo.mock.results[0].value;

    // We can't directly trigger internal functions but we can check if usePageNavigation was called
    // which we already did in hook tests. Here we can check if onMoveForward/Back were defined correctly.
    const pageNavCall = vi.mocked(pageNav.usePageNavigation).mock.calls[0];
    const forward = pageNavCall[0];
    const back = pageNavCall[1];

    forward();
    expect(mockRendition.next).toHaveBeenCalled();

    back();
    expect(mockRendition.prev).toHaveBeenCalled();
  });
});
