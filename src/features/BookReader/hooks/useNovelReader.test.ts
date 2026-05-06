import type { Theme } from "@mui/material";
import { readFile } from "@tauri-apps/plugin-fs";
import { renderHook, waitFor } from "@testing-library/react";
import { Paginator } from "foliate-js/paginator.js";
import { type Book, makeBook, type View } from "foliate-js/view.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAppTheme } from "../../../hooks/useAppTheme";
import { type RootState, useAppDispatch, useAppSelector } from "../../../store/store";
import { setEntries, setNovelLocation } from "../slice";
import { useNovelReader } from "./useNovelReader";

// Mocks
vi.mock("../../../store/store");
vi.mock("../../../hooks/useAppTheme");
vi.mock("@tauri-apps/plugin-fs");
vi.mock("@tauri-apps/plugin-log");
vi.mock("foliate-js/view.js", () => ({
  makeBook: vi.fn(),
}));
vi.mock("foliate-js/paginator.js", () => {
  class Paginator {
    setStyles = vi.fn();
    setAttribute = vi.fn();
    removeAttribute = vi.fn();
  }
  return { Paginator };
});
vi.mock("../slice", () => ({
  setEntries: vi.fn((entries: string[]) => ({ type: "setEntries", payload: entries })),
  setNovelLocation: vi.fn((loc: { index: number; cfi: string }) => ({
    type: "setNovelLocation",
    payload: loc,
  })),
  default: vi.fn(),
}));

interface ExtendedView extends View {
  renderer: Paginator;
  lastLocation: { cfi: string; index: number };
}

// Mock foliate-view custom element
class MockView extends HTMLElement implements Partial<ExtendedView> {
  open = vi.fn<(book: Book) => Promise<void>>().mockResolvedValue(undefined);
  close = vi.fn<() => void>();
  remove = vi.fn<() => void>();
  init = vi
    .fn<(options: { lastLocation: string | number }) => Promise<void>>()
    .mockResolvedValue(undefined);
  goTo = vi.fn<(location: string | number) => Promise<void>>().mockResolvedValue(undefined);
  next = vi.fn<(distance?: number) => Promise<void>>().mockResolvedValue(undefined);
  prev = vi.fn<(distance?: number) => Promise<void>>().mockResolvedValue(undefined);
  renderer = new Paginator();
  lastLocation = { cfi: "epubcfi(/6/4[chap01]!/4/2/2[p1])", index: 0 };
}

if (!customElements.get("foliate-view")) {
  customElements.define("foliate-view", MockView);
}

describe("useNovelReader", () => {
  const mockDispatch = vi.fn();
  const mockTheme = {
    palette: {
      mode: "light",
      text: { primary: "#000", secondary: "#555" },
      primary: { main: "#1976d2" },
    },
  } as Theme;

  const defaultState = {
    read: {
      containerFile: {
        index: 0,
        cfi: null as string | null,
      },
    },
    settings: {
      reader: {
        comic: {
          readingDirection: "rtl" as const,
        },
        novel: {
          fontFamily: "default-font",
          fontSize: 16,
        },
      },
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAppDispatch).mockReturnValue(mockDispatch);
    vi.mocked(useAppTheme).mockReturnValue(mockTheme);
    vi.mocked(useAppSelector).mockImplementation(<T>(selector: (state: RootState) => T): T => {
      return selector(defaultState as RootState);
    });
    vi.mocked(readFile).mockResolvedValue(new Uint8Array([1, 2, 3]));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const setupHook = (initialPath = "test.epub") => {
    const { result, rerender, unmount } = renderHook(
      ({ filePath }) => useNovelReader({ filePath }),
      {
        initialProps: { filePath: "" },
      },
    );
    result.current.viewerRef.current = document.createElement("div");
    if (initialPath) {
      rerender({ filePath: initialPath });
    }
    return { result, rerender, unmount };
  };

  it("should load an EPUB book and initialize the view", async () => {
    const mockBook = {
      sections: [{ id: "sec1" }, { id: "sec2" }],
      toc: [{ href: "sec1.xhtml", label: "Chapter 1" }],
      resolveHref: vi.fn().mockReturnValue({ index: 0 }),
      destroy: vi.fn(),
    } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result } = setupHook();

    await waitFor(() => {
      expect(readFile).toHaveBeenCalledWith("test.epub");
      expect(makeBook).toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalledWith(setEntries(["Chapter 1", "sec2"]));
    });

    const viewerElement = result.current.viewerRef.current;
    expect(viewerElement).not.toBeNull();
    const viewElement = viewerElement?.querySelector("foliate-view") as MockView;
    expect(viewElement).not.toBeNull();
    expect(viewElement.open).toHaveBeenCalledWith(mockBook);
    expect(viewElement.init).toHaveBeenCalled();
  });

  it("should not load non-EPUB files", async () => {
    setupHook("test.pdf");

    await waitFor(() => {
      expect(readFile).not.toHaveBeenCalled();
      expect(makeBook).not.toHaveBeenCalled();
    });
  });

  it("should apply theme styles to the view", async () => {
    const mockBook = {
      sections: [],
      toc: [],
      destroy: vi.fn(),
    } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
      expect(viewElement.renderer.setStyles).toHaveBeenCalled();
      const cssArgument = vi.mocked(viewElement.renderer.setStyles).mock.calls[0][0];
      expect(cssArgument).toContain("color: #000");
      expect(cssArgument).toContain("font-size: 16px");
    });
  });

  it("should navigate to next page", async () => {
    const mockBook = {
      sections: [],
      toc: [],
      destroy: vi.fn(),
    } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;

    // Simulate "load" event to attach document event listeners
    const mockDoc = document.createElement("div");
    const loadEvent = new CustomEvent("load", { detail: { doc: mockDoc } });
    viewElement.dispatchEvent(loadEvent);

    // Simulate click on the document
    mockDoc.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(viewElement.next).toHaveBeenCalled();
  });

  it("should navigate to previous page on context menu", async () => {
    const mockBook = {
      sections: [],
      toc: [],
      destroy: vi.fn(),
    } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;

    const mockDoc = document.createElement("div");
    const loadEvent = new CustomEvent("load", { detail: { doc: mockDoc } });
    viewElement.dispatchEvent(loadEvent);

    mockDoc.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true }));
    expect(viewElement.prev).toHaveBeenCalled();
  });

  it("should dispatch setNovelLocation on relocate event with different detail formats", async () => {
    const mockBook = {
      sections: [],
      toc: [],
      destroy: vi.fn(),
    } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;

    // Case 1: section.current
    viewElement.dispatchEvent(
      new CustomEvent("relocate", {
        detail: { section: { current: 1 }, cfi: "cfi1" },
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(setNovelLocation({ index: 1, cfi: "cfi1" }));

    // Case 2: detail.index
    viewElement.dispatchEvent(
      new CustomEvent("relocate", {
        detail: { index: 2, cfi: "cfi2" },
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(setNovelLocation({ index: 2, cfi: "cfi2" }));

    // Case 4: section exists but current is missing, fallback to index
    viewElement.dispatchEvent(
      new CustomEvent("relocate", {
        detail: { section: {}, index: 3, cfi: "cfi3" },
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(setNovelLocation({ index: 3, cfi: "cfi3" }));

    // Case 5: fallback to 0 and empty string
    viewElement.dispatchEvent(
      new CustomEvent("relocate", {
        detail: {},
      }),
    );
    expect(mockDispatch).toHaveBeenCalledWith(setNovelLocation({ index: 0, cfi: "" }));
  });

  it("should not dispatch setNovelLocation if unmounted during relocate event", async () => {
    const mockBook = {
      sections: [],
      toc: [],
      destroy: vi.fn(),
    } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result, unmount } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;

    unmount();

    viewElement.dispatchEvent(
      new CustomEvent("relocate", {
        detail: { index: 1, cfi: "cfi1" },
      }),
    );
    expect(mockDispatch).not.toHaveBeenCalledWith(setNovelLocation(expect.anything()));
  });

  it("should handle vertical and horizontal layouts in load event", async () => {
    const mockBook = {
      sections: [],
      toc: [],
      destroy: vi.fn(),
    } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;

    // Simulate vertical layout
    const mockDocVertical = {
      defaultView: {
        getComputedStyle: vi.fn().mockReturnValue({ writingMode: "vertical-rl" }),
      },
      body: {},
      addEventListener: vi.fn(),
    };
    viewElement.dispatchEvent(new CustomEvent("load", { detail: { doc: mockDocVertical } }));
    expect(viewElement.renderer.setAttribute).toHaveBeenCalledWith("max-inline-size", "10000px");

    // Simulate horizontal layout
    const mockDocHorizontal = {
      defaultView: {
        getComputedStyle: vi.fn().mockReturnValue({ writingMode: "horizontal-tb" }),
      },
      body: {},
      addEventListener: vi.fn(),
    };
    viewElement.dispatchEvent(new CustomEvent("load", { detail: { doc: mockDocHorizontal } }));
    expect(viewElement.renderer.removeAttribute).toHaveBeenCalledWith("max-inline-size");
  });

  it("should handle navigation failures and log errors", async () => {
    const { error } = await import("@tauri-apps/plugin-log");
    const mockBook = {
      sections: [],
      toc: [],
      destroy: vi.fn(),
    } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { rerender, result } = renderHook(
      ({ cfi, filePath }) => {
        vi.mocked(useAppSelector).mockImplementation(<T>(selector: (state: RootState) => T): T => {
          return selector({
            ...defaultState,
            read: { containerFile: { index: 0, cfi } },
          } as RootState);
        });
        return useNovelReader({ filePath });
      },
      { initialProps: { cfi: null as string | null, filePath: "" } },
    );

    result.current.viewerRef.current = document.createElement("div");
    rerender({ cfi: null, filePath: "test.epub" });

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;
    vi.mocked(viewElement.goTo).mockRejectedValue(new Error("Navigation failed"));

    // Change CFI to trigger goTo
    rerender({ cfi: "bad-cfi", filePath: "test.epub" });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Failed to navigate to CFI(bad-cfi)"),
      );
    });
  });

  it("should log an error if navigation to index fails", async () => {
    const { error } = await import("@tauri-apps/plugin-log");
    const mockBook = { sections: [], toc: [], destroy: vi.fn() } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { rerender, result } = renderHook(
      ({ index, filePath }) => {
        vi.mocked(useAppSelector).mockImplementation(<T>(selector: (state: RootState) => T): T => {
          return selector({
            ...defaultState,
            read: { containerFile: { index, cfi: null } },
          } as RootState);
        });
        return useNovelReader({ filePath });
      },
      { initialProps: { index: 0, filePath: "" } },
    );

    result.current.viewerRef.current = document.createElement("div");
    rerender({ index: 0, filePath: "test.epub" });

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;
    vi.mocked(viewElement.goTo).mockRejectedValue(new Error("Index navigation failed"));

    // Change index
    rerender({ index: 5, filePath: "test.epub" });

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(expect.stringContaining("Failed to navigate to index(5)"));
    });
  });

  it("should build TOC map with nested items and handle missing href/label", async () => {
    const mockBook = {
      sections: [{ id: "sec1" }, { id: "sec2" }, { id: "sec3" }],
      toc: [
        {
          href: "sec1.xhtml",
          label: "Chapter 1",
          subitems: [
            { href: "sec2.xhtml", label: "Sub-chapter 1.1" },
            { href: "missing.xhtml", label: "Missing" },
          ],
        },
        { href: "sec3.xhtml", label: "Chapter 2" },
      ],
      resolveHref: vi.fn((href) => {
        if (href === "sec1.xhtml") return { index: 0 };
        if (href === "sec2.xhtml") return { index: 1 };
        if (href === "sec3.xhtml") return { index: 2 };
        return null;
      }),
      destroy: vi.fn(),
    } as unknown as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    setupHook();

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        setEntries(["Chapter 1", "Sub-chapter 1.1", "Chapter 2"]),
      );
    });
  });

  it("should destroy previous book instance when filePath changes", async () => {
    const mockBook1 = { sections: [], toc: [], destroy: vi.fn() } as unknown as Book;
    const mockBook2 = { sections: [], toc: [], destroy: vi.fn() } as unknown as Book;
    vi.mocked(makeBook).mockResolvedValueOnce(mockBook1).mockResolvedValueOnce(mockBook2);

    const { rerender } = setupHook("book1.epub");

    await waitFor(() => {
      expect(makeBook).toHaveBeenCalledTimes(1);
    });

    rerender({ filePath: "book2.epub" });

    await waitFor(() => {
      expect(mockBook1.destroy).toHaveBeenCalled();
      expect(makeBook).toHaveBeenCalledTimes(2);
    });
  });

  it("should handle book with no sections", async () => {
    const mockBook = {
      sections: null,
      toc: [],
      destroy: vi.fn(),
    } as unknown as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    setupHook();

    await waitFor(() => {
      expect(readFile).toHaveBeenCalled();
    });
    expect(mockDispatch).not.toHaveBeenCalledWith(setEntries(expect.anything()));
  });

  it("should handle cleanup when viewRef and bookRef are null", async () => {
    const { unmount } = renderHook(({ filePath }) => useNovelReader({ filePath }), {
      initialProps: { filePath: "" },
    });
    // Unmount before anything is loaded
    unmount();
    // No error should occur
  });

  it("should apply custom font and handle Linux specific styles", async () => {
    vi.mocked(useAppSelector).mockImplementation(<T>(selector: (state: RootState) => T): T => {
      const state = {
        ...defaultState,
        settings: {
          ...defaultState.settings,
          reader: {
            ...defaultState.settings.reader,
            novel: { fontFamily: "CustomFont", fontSize: 20 },
          },
        },
      };
      return selector(state as RootState);
    });

    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value: "Linux",
      configurable: true,
    });

    const mockBook = { sections: [], toc: [], destroy: vi.fn() } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
      const cssArgument = vi.mocked(viewElement.renderer.setStyles).mock.calls[0][0];
      expect(cssArgument).toContain('font-family: "CustomFont" !important;');
      expect(cssArgument).toContain("font-size: 20px !important;");
      expect(cssArgument).toContain('.vrtl { font-feature-settings: "vert"; }');
    });

    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
  });

  it("should handle load event when defaultView is missing", async () => {
    const mockBook = { sections: [], toc: [], destroy: vi.fn() } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;

    const mockDoc = {
      body: {},
      addEventListener: vi.fn(),
    };
    viewElement.dispatchEvent(new CustomEvent("load", { detail: { doc: mockDoc } }));
    expect(viewElement.renderer.removeAttribute).toHaveBeenCalledWith("max-inline-size");
  });

  it("should not navigate when clicking on a link", async () => {
    const mockBook = { sections: [], toc: [], destroy: vi.fn() } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;

    const mockDoc = document.createElement("div");
    const link = document.createElement("a");
    mockDoc.appendChild(link);

    viewElement.dispatchEvent(new CustomEvent("load", { detail: { doc: mockDoc } }));

    link.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(viewElement.next).not.toHaveBeenCalled();
  });

  it("should initialize with CFI if available, otherwise with index", async () => {
    vi.mocked(useAppSelector).mockImplementation(<T>(selector: (state: RootState) => T): T => {
      const state = {
        ...defaultState,
        read: { containerFile: { index: 5, cfi: "saved-cfi" } },
      };
      return selector(state as RootState);
    });

    const mockBook = { sections: [], toc: [], destroy: vi.fn() } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { result } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
      expect(viewElement.init).toHaveBeenCalledWith({ lastLocation: "saved-cfi" });
    });
  });

  it("should destroy book if unmounted during loading", async () => {
    let resolveBook: ((value: Book) => void) | undefined;
    const bookPromise = new Promise<Book>((resolve) => {
      resolveBook = resolve;
    });
    vi.mocked(makeBook).mockReturnValue(bookPromise);

    const mockBook = {
      sections: [],
      toc: [],
      destroy: vi.fn(),
    } as unknown as Book;

    const { unmount, rerender, result } = renderHook(
      ({ filePath }) => useNovelReader({ filePath }),
      { initialProps: { filePath: "" } },
    );
    result.current.viewerRef.current = document.createElement("div");

    // Start loading
    rerender({ filePath: "test.epub" });

    // Ensure makeBook has been called
    await waitFor(() => expect(makeBook).toHaveBeenCalled());

    // Unmount while loading (isMounted becomes false)
    unmount();

    // Resolve the book
    resolveBook?.(mockBook);

    await waitFor(() => {
      expect(mockBook.destroy).toHaveBeenCalled();
    });
  });

  it("should log an error if loading the book fails", async () => {
    const { error } = await import("@tauri-apps/plugin-log");
    vi.mocked(readFile).mockRejectedValue(new Error("File read error"));

    setupHook("error.epub");

    await waitFor(() => {
      expect(error).toHaveBeenCalledWith(
        expect.stringContaining("Error loading EPUB file: Error: File read error"),
      );
    });
  });

  it("should navigate to index if CFI is missing and index changes", async () => {
    const mockBook = { sections: [], toc: [], destroy: vi.fn() } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { rerender, result } = renderHook(
      ({ index, filePath }) => {
        vi.mocked(useAppSelector).mockImplementation(<T>(selector: (state: RootState) => T): T => {
          return selector({
            ...defaultState,
            read: { containerFile: { index, cfi: null } },
          } as RootState);
        });
        return useNovelReader({ filePath });
      },
      { initialProps: { index: 0, filePath: "" } },
    );

    result.current.viewerRef.current = document.createElement("div");
    rerender({ index: 0, filePath: "test.epub" });

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;

    // Change index
    rerender({ index: 5, filePath: "test.epub" });

    await waitFor(() => {
      expect(viewElement.goTo).toHaveBeenCalledWith(5);
    });
  });

  it("should perform cleanup when unmounted", async () => {
    const mockBook = { sections: [], toc: [], destroy: vi.fn() } as Book;
    vi.mocked(makeBook).mockResolvedValue(mockBook);

    const { unmount, result } = setupHook();

    await waitFor(() => {
      const viewElement = result.current.viewerRef.current?.querySelector(
        "foliate-view",
      ) as MockView;
      expect(viewElement).not.toBeNull();
    });

    const viewElement = result.current.viewerRef.current?.querySelector("foliate-view") as MockView;

    unmount();

    expect(viewElement.close).toHaveBeenCalled();
    expect(viewElement.remove).toHaveBeenCalled();
    expect(mockBook.destroy).toHaveBeenCalled();
  });
});
